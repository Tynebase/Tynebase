import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { generateText } from '../services/ai/bedrock';

const ApplySuggestionRequestSchema = z.object({
  document_id: z.string().uuid('Invalid document ID format'),
  suggestion: z.object({
    type: z.enum(['grammar', 'clarity', 'structure', 'completeness', 'style']),
    title: z.string().min(1, 'Suggestion title is required'),
    reason: z.string().min(1, 'Suggestion reason is required'),
    original: z.string().optional(),
    suggested: z.string().optional(),
  }),
  context: z.string().optional(),
});

type ApplySuggestionRequest = z.infer<typeof ApplySuggestionRequestSchema>;

/**
 * AI Apply Suggestion endpoint
 * POST /api/ai/enhance/apply
 * Generates content for a specific enhancement suggestion
 */
export default async function aiApplySuggestionRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: ApplySuggestionRequest }>(
    '/api/ai/enhance/apply',
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
        const validated = ApplySuggestionRequestSchema.parse(request.body);

        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, tenant_id, title, content, author_id')
          .eq('id', validated.document_id)
          .single();

        if (docError) {
          if (docError.code === 'PGRST116') {
            return reply.status(404).send({
              error: {
                code: 'DOCUMENT_NOT_FOUND',
                message: 'The requested document does not exist',
              },
            });
          }

          request.log.error(
            {
              documentId: validated.document_id,
              error: docError.message,
            },
            'Failed to fetch document'
          );
          return reply.status(500).send({
            error: {
              code: 'DOCUMENT_FETCH_FAILED',
              message: 'Unable to retrieve document',
            },
          });
        }

        if (document.tenant_id !== tenant.id) {
          request.log.warn(
            {
              documentId: validated.document_id,
              documentTenantId: document.tenant_id,
              requestTenantId: tenant.id,
              userId: user.id,
            },
            'Unauthorized document access attempt'
          );
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to access this document',
            },
          });
        }

        if (!document.content || document.content.trim().length === 0) {
          return reply.status(400).send({
            error: {
              code: 'EMPTY_DOCUMENT',
              message: 'Document has no content',
            },
          });
        }

        const { data: consent, error: consentError } = await supabaseAdmin
          .from('user_consents')
          .select('ai_processing')
          .eq('user_id', user.id)
          .single();

        if (consentError && consentError.code !== 'PGRST116') {
          request.log.error(
            {
              userId: user.id,
              error: consentError.message,
            },
            'Failed to check user consent'
          );
          return reply.status(500).send({
            error: {
              code: 'CONSENT_CHECK_FAILED',
              message: 'Unable to verify consent preferences',
            },
          });
        }

        if (consent && consent.ai_processing === false) {
          return reply.status(403).send({
            error: {
              code: 'CONSENT_REQUIRED',
              message: 'AI processing consent is required. Please update your privacy settings.',
            },
          });
        }

        const currentMonth = new Date().toISOString().slice(0, 7);
        const creditsToDeduct = 1;

        const { data: deductResult, error: deductError } = await supabaseAdmin.rpc(
          'deduct_credits',
          {
            p_tenant_id: tenant.id,
            p_credits: creditsToDeduct,
            p_month_year: currentMonth,
          }
        );

        if (deductError) {
          request.log.error(
            {
              tenantId: tenant.id,
              error: deductError.message,
            },
            'Failed to deduct credits'
          );
          return reply.status(500).send({
            error: {
              code: 'CREDIT_DEDUCTION_FAILED',
              message: 'Unable to deduct credits for this operation',
            },
          });
        }

        if (!deductResult || deductResult.length === 0 || !deductResult[0].success) {
          const errorMessage = deductResult?.[0]?.error_message || 'Insufficient credits';
          return reply.status(403).send({
            error: {
              code: 'INSUFFICIENT_CREDITS',
              message: errorMessage,
            },
          });
        }

        let prompt: string;
        const suggestion = validated.suggestion;

        if (suggestion.suggested) {
          prompt = `You are a professional document editor helping to improve a knowledge base article.

Document Title: ${document.title}
Document Content:
${document.content}

Suggestion Type: ${suggestion.type}
Suggestion: ${suggestion.title}
Reason: ${suggestion.reason}
Original Text: ${suggestion.original || 'N/A'}
Suggested Improvement: ${suggestion.suggested}

Generate the improved content based on this suggestion. Return ONLY the generated content that should be inserted or replace the original text. Do not include explanations or formatting markers.`;
        } else {
          const contextText = validated.context || document.content.slice(0, 1000);
          prompt = `You are a professional document editor helping to improve a knowledge base article.

Document Title: ${document.title}
Context:
${contextText}

Suggestion Type: ${suggestion.type}
Suggestion: ${suggestion.title}
Reason: ${suggestion.reason}
${suggestion.original ? `Original Text: ${suggestion.original}` : ''}

Generate improved content that addresses this suggestion. Return ONLY the generated content that should be added or replace the original text. Do not include explanations or formatting markers.`;
        }

        const startTime = Date.now();
        
        const aiResponse = await generateText({
          prompt,
          model: 'deepseek-v3',
          maxTokens: 1500,
          temperature: 0.5,
        });

        const duration = Date.now() - startTime;

        if (duration > 10000) {
          request.log.warn(
            {
              documentId: validated.document_id,
              duration,
            },
            'AI apply suggestion request exceeded 10s timeout'
          );
        }

        const generatedContent = aiResponse.content.trim();

        if (!generatedContent || generatedContent.length === 0) {
          request.log.error(
            {
              documentId: validated.document_id,
              suggestionType: suggestion.type,
            },
            'AI returned empty content'
          );
          return reply.status(500).send({
            error: {
              code: 'AI_GENERATION_FAILED',
              message: 'Unable to generate content for this suggestion',
            },
          });
        }

        const { error: usageError } = await supabaseAdmin
          .from('query_usage')
          .insert({
            tenant_id: tenant.id,
            user_id: user.id,
            query_type: 'apply_suggestion',
            ai_model: aiResponse.model,
            tokens_input: aiResponse.tokensInput,
            tokens_output: aiResponse.tokensOutput,
            credits_charged: creditsToDeduct,
            metadata: {
              document_id: validated.document_id,
              document_title: document.title,
              suggestion_type: suggestion.type,
              suggestion_title: suggestion.title,
              duration_ms: duration,
              content_length: generatedContent.length,
            },
          });

        if (usageError) {
          request.log.error(
            {
              tenantId: tenant.id,
              userId: user.id,
              error: usageError.message,
            },
            'Failed to log query usage'
          );
        }

        request.log.info(
          {
            documentId: validated.document_id,
            tenantId: tenant.id,
            userId: user.id,
            suggestionType: suggestion.type,
            tokensInput: aiResponse.tokensInput,
            tokensOutput: aiResponse.tokensOutput,
            duration,
            contentLength: generatedContent.length,
          },
          'Apply suggestion completed'
        );

        return reply.status(200).send({
          generated_content: generatedContent,
          suggestion_type: suggestion.type,
          credits_used: creditsToDeduct,
          tokens_used: aiResponse.tokensInput + aiResponse.tokensOutput,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request parameters',
              details: errorMessages,
            },
          });
        }

        request.log.error(
          {
            tenantId: tenant.id,
            userId: user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error in AI apply suggestion endpoint'
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
