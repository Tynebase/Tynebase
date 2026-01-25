import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { creditGuardMiddleware } from '../middleware/creditGuard';
import { supabaseAdmin } from '../lib/supabase';
import { dispatchJob } from '../utils/dispatchJob';
import { countTokens } from '../utils/tokenCounter';
import { estimateTextGenerationCredits } from '../utils/creditCalculator';

const GenerateRequestSchema = z.object({
  prompt: z.string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(10000, 'Prompt must not exceed 10,000 characters'),
  model: z.enum(['gpt-5.2', 'claude-sonnet-4.5', 'claude-opus-4.5', 'gemini-3-flash'])
    .optional()
    .default('gpt-5.2'),
  max_tokens: z.number()
    .int()
    .min(100)
    .max(4000)
    .optional()
    .default(2000),
});

type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/**
 * AI Generate endpoint for creating documents from prompts
 * POST /api/ai/generate
 */
export default async function aiGenerateRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: GenerateRequest }>(
    '/api/ai/generate',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
        creditGuardMiddleware,
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
        const validated = GenerateRequestSchema.parse(request.body);

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
          request.log.warn(
            {
              userId: user.id,
              tenantId: tenant.id,
            },
            'User has not consented to AI processing'
          );
          return reply.status(403).send({
            error: {
              code: 'CONSENT_REQUIRED',
              message: 'AI processing consent is required. Please update your privacy settings.',
            },
          });
        }

        const inputTokens = countTokens(validated.prompt, 'gpt-4');
        const estimatedOutputTokens = validated.max_tokens;

        const estimatedCredits = estimateTextGenerationCredits(
          inputTokens,
          estimatedOutputTokens,
          validated.model as any
        );

        request.log.info(
          {
            tenantId: tenant.id,
            userId: user.id,
            inputTokens,
            estimatedOutputTokens,
            estimatedCredits,
            model: validated.model,
          },
          'Estimating credits for AI generation'
        );

        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: deductResult, error: deductError } = await supabaseAdmin.rpc(
          'deduct_credits',
          {
            p_tenant_id: tenant.id,
            p_credits: estimatedCredits,
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
          request.log.warn(
            {
              tenantId: tenant.id,
              estimatedCredits,
              errorMessage,
            },
            'Credit deduction failed'
          );
          return reply.status(403).send({
            error: {
              code: 'INSUFFICIENT_CREDITS',
              message: errorMessage,
            },
          });
        }

        const job = await dispatchJob({
          tenantId: tenant.id,
          type: 'ai_generation',
          payload: {
            prompt: validated.prompt,
            model: validated.model,
            max_tokens: validated.max_tokens,
            user_id: user.id,
            estimated_credits: estimatedCredits,
          },
        });

        request.log.info(
          {
            jobId: job.id,
            tenantId: tenant.id,
            userId: user.id,
            creditsDeducted: estimatedCredits,
          },
          'AI generation job dispatched successfully'
        );

        return reply.status(202).send({
          job_id: job.id,
          status: 'pending',
          estimated_credits: estimatedCredits,
          message: 'Generation job queued successfully',
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
          'Error in AI generate endpoint'
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
