import { FastifyInstance } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { dispatchJob } from '../utils/dispatchJob';
import { z } from 'zod';
import { getModelCreditCost } from '../utils/creditCalculator';

const VideoTranscribeRequestSchema = z.object({
  document_id: z.string().uuid(),
  video_url: z.string().url(),
  video_type: z.enum(['youtube', 'uploaded']),
  output_options: z.object({
    generate_transcript: z.boolean(),
    generate_summary: z.boolean(),
    generate_article: z.boolean(),
    append_to_document: z.boolean(),
    ai_model: z.string(),
  }).optional(),
});

/**
 * Video Transcribe to Document endpoint
 * POST /api/documents/:id/transcribe-video
 * 
 * Transcribes an embedded video and appends the transcript to the document
 * Flow: Sidecar → GCS → Gemini 2.5 Flash → Generate with selected model → Append MD to document
 * 
 * Cost: 10 credits base + 2 per summary/article output
 */
export default async function videoTranscribeToDocumentRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Params: { id: string };
    Body: {
      video_url: string;
      video_type: 'youtube' | 'uploaded';
      output_options?: {
        generate_transcript: boolean;
        generate_summary: boolean;
        generate_article: boolean;
        append_to_document: boolean;
        ai_model: string;
      };
    };
  }>(
    '/api/documents/:id/transcribe-video',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
      ],
    },
    async (request, reply) => {
      const tenant = (request as any).tenant;
      const user = request.user;

      if (!tenant || !tenant.id) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Tenant context not available',
          },
        });
      }

      if (!user || !user.id) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
          },
        });
      }

      try {
        const documentId = request.params.id;
        const validated = VideoTranscribeRequestSchema.parse({
          document_id: documentId,
          video_url: request.body.video_url,
          video_type: request.body.video_type,
          output_options: request.body.output_options,
        });

        // Check if document exists and user has access
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, tenant_id, title, content')
          .eq('id', validated.document_id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.status(404).send({
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Document not found or access denied',
            },
          });
        }

        // Calculate required credits based on output options
        const outputOptions = validated.output_options || {
          generate_transcript: true,
          generate_summary: false,
          generate_article: false,
          append_to_document: true,
          ai_model: 'gemini',
        };

        request.log.info({ outputOptions }, 'Video transcribe output options');
        
        const aiModel = outputOptions.ai_model || 'gemini';
        const isClaudeOutput = aiModel.includes('claude');
        const BASE_CREDITS = isClaudeOutput ? 6 : 5;
        const modelCost = getModelCreditCost(aiModel);
        
        const REQUIRED_CREDITS = BASE_CREDITS + 
          (outputOptions.generate_summary ? modelCost : 0) + 
          (outputOptions.generate_article ? modelCost : 0);
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        const { data: creditData, error: creditError } = await supabaseAdmin
          .rpc('get_credit_balance', {
            p_tenant_id: tenant.id,
            p_month_year: currentMonth,
          });

        if (creditError) {
          request.log.error({ error: creditError, tenantId: tenant.id }, 'Failed to check credit balance');
          return reply.status(500).send({
            error: {
              code: 'CREDIT_CHECK_FAILED',
              message: 'Failed to check credit balance',
            },
          });
        }

        const availableCredits = creditData?.[0]?.available_credits || 0;

        if (availableCredits < REQUIRED_CREDITS) {
          return reply.status(402).send({
            error: {
              code: 'INSUFFICIENT_CREDITS',
              message: `Insufficient credits. Required: ${REQUIRED_CREDITS}, Available: ${availableCredits}`,
            },
          });
        }

        request.log.info(
          {
            documentId: validated.document_id,
            videoUrl: validated.video_url,
            videoType: validated.video_type,
            tenantId: tenant.id,
            userId: user.id,
            outputOptions,
          },
          'Starting video transcription to document'
        );

        // Dispatch background job for transcription
        const jobPayload = {
          document_id: validated.document_id,
          video_url: validated.video_url,
          video_type: validated.video_type,
          user_id: user.id,
          credits_to_charge: REQUIRED_CREDITS,
          output_options: outputOptions,
        };
        
        request.log.info({ jobPayload }, 'Dispatching job with payload');
        
        const job = await dispatchJob({
          tenantId: tenant.id,
          type: 'video_transcribe_to_document',
          payload: jobPayload,
        });

        request.log.info(
          {
            jobId: job.id,
            documentId: validated.document_id,
            videoUrl: validated.video_url,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Video transcription job dispatched'
        );

        return reply.status(202).send({
          message: 'Video transcription started',
          job_id: job.id,
          document_id: validated.document_id,
          video_url: validated.video_url,
          credits_charged: REQUIRED_CREDITS,
          status: 'processing',
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: error.errors.map(e => e.message).join(', '),
            },
          });
        }

        request.log.error(
          {
            tenantId: tenant.id,
            userId: user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error in video transcribe to document endpoint'
        );

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while processing your request',
          },
        });
      }
    }
  );
}
