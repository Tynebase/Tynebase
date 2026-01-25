import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { generateText } from '../services/ai/bedrock';

const EnhanceRequestSchema = z.object({
  document_id: z.string().uuid('Invalid document ID format'),
});

type EnhanceRequest = z.infer<typeof EnhanceRequestSchema>;

interface EnhanceSuggestion {
  type: 'grammar' | 'clarity' | 'structure' | 'completeness' | 'style';
  title: string;
  reason: string;
  original?: string;
  suggested?: string;
}

interface EnhanceResponse {
  score: number;
  suggestions: EnhanceSuggestion[];
}

/**
 * AI Document Enhancement endpoint
 * POST /api/ai/enhance
 * Analyzes document completeness and provides improvement suggestions
 */
export default async function aiEnhanceRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: EnhanceRequest }>(
    '/api/ai/enhance',
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
        const validated = EnhanceRequestSchema.parse(request.body);

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
              message: 'Document has no content to analyze',
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

        const prompt = `You are a professional document editor analyzing a knowledge base article for completeness and quality.

Document Title: ${document.title}
Document Content:
${document.content}

Analyze this document and provide:
1. A completeness score from 0-100 (where 100 is perfectly complete and polished)
2. Between 3-5 specific, actionable suggestions for improvement

Focus on:
- Missing sections or information gaps
- Clarity and readability issues
- Structural improvements
- Grammar and style issues
- Areas that need more detail or examples

Return your analysis in the following JSON format:
{
  "score": <number 0-100>,
  "suggestions": [
    {
      "type": "completeness|clarity|structure|grammar|style",
      "title": "Brief title of the issue",
      "reason": "Explanation of why this needs improvement",
      "original": "Optional: specific text that needs improvement",
      "suggested": "Optional: suggested replacement text"
    }
  ]
}

Provide only the JSON response, no additional text.`;

        const startTime = Date.now();
        
        const aiResponse = await generateText({
          prompt,
          model: 'deepseek-v3',
          maxTokens: 2000,
          temperature: 0.3,
        });

        const duration = Date.now() - startTime;

        if (duration > 10000) {
          request.log.warn(
            {
              documentId: validated.document_id,
              duration,
            },
            'AI enhance request exceeded 10s timeout'
          );
        }

        let enhanceResult: EnhanceResponse;
        try {
          const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in AI response');
          }
          enhanceResult = JSON.parse(jsonMatch[0]);

          if (typeof enhanceResult.score !== 'number' || 
              enhanceResult.score < 0 || 
              enhanceResult.score > 100) {
            throw new Error('Invalid score in AI response');
          }

          if (!Array.isArray(enhanceResult.suggestions) || 
              enhanceResult.suggestions.length < 3 || 
              enhanceResult.suggestions.length > 5) {
            throw new Error('Invalid suggestions count in AI response');
          }
        } catch (parseError) {
          request.log.error(
            {
              documentId: validated.document_id,
              aiResponse: aiResponse.content,
              error: parseError instanceof Error ? parseError.message : 'Unknown error',
            },
            'Failed to parse AI response'
          );
          return reply.status(500).send({
            error: {
              code: 'AI_RESPONSE_PARSE_FAILED',
              message: 'Unable to parse AI analysis results',
            },
          });
        }

        const { error: usageError } = await supabaseAdmin
          .from('query_usage')
          .insert({
            tenant_id: tenant.id,
            user_id: user.id,
            query_type: 'enhance',
            ai_model: aiResponse.model,
            tokens_input: aiResponse.tokensInput,
            tokens_output: aiResponse.tokensOutput,
            credits_charged: creditsToDeduct,
            metadata: {
              document_id: validated.document_id,
              document_title: document.title,
              score: enhanceResult.score,
              suggestions_count: enhanceResult.suggestions.length,
              duration_ms: duration,
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
            score: enhanceResult.score,
            suggestionsCount: enhanceResult.suggestions.length,
            tokensInput: aiResponse.tokensInput,
            tokensOutput: aiResponse.tokensOutput,
            duration,
          },
          'Document enhancement completed'
        );

        return reply.status(200).send({
          score: enhanceResult.score,
          suggestions: enhanceResult.suggestions,
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
          'Error in AI enhance endpoint'
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
