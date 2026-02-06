import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { generateText as generateTextClaude } from '../services/ai/anthropic';
import { getModelCreditCost } from '../utils/creditCalculator';

const EnhanceRequestSchema = z.object({
  document_id: z.string().uuid('Invalid document ID format'),
  custom_prompt: z.string().optional(),
});

type EnhanceRequest = z.infer<typeof EnhanceRequestSchema>;

interface EnhanceSuggestion {
  type: 'grammar' | 'clarity' | 'structure' | 'completeness' | 'style';
  action: 'add' | 'replace' | 'delete';
  title: string;
  reason: string;
  // For 'add' action: the content to add
  content?: string;
  // For 'replace' and 'delete' actions: the exact text to find
  find?: string;
  // For 'replace' action: the replacement text
  replace?: string;
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
        // Enhancement uses Claude Sonnet = 5 credits
        const creditsToDeduct = getModelCreditCost('claude');

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

        const customInstructions = validated.custom_prompt
          ? `\n\nADDITIONAL USER INSTRUCTIONS:\n${validated.custom_prompt}\n\nIncorporate these instructions into your analysis and suggestions where appropriate.`
          : '';

        const prompt = `You are a professional document editor. Your task is to analyze document content and provide specific, actionable improvements.

CRITICAL FORMATTING RULES:
- Preserve ALL original spacing, punctuation, and formatting exactly
- NEVER add random letters, characters, or gibberish
- NEVER remove spaces between words or sentences
- NEVER invent content that doesn't improve the existing text
- When suggesting replacements, the "find" text MUST match the document exactly character-for-character

IMPORTANT:
- You MUST NOT suggest changing the document title, metadata, or filenames.
- You MUST NOT add random characters, hallucinate content, or invent information.
- You MUST preserve exact spacing and formatting from the original document.

Document Title: ${document.title}
Document Content:
${document.content}${customInstructions}

Provide:
1. A DOCUMENT QUALITY SCORE from 0-100 based on these criteria:
   - Grammar & spelling (20 points): Is it error-free?
   - Clarity (20 points): Is the writing clear and easy to understand?
   - Structure (20 points): Is it well-organized with logical flow?
   - Completeness (20 points): Does it cover the topic adequately?
   - Style (20 points): Is the tone appropriate and engaging?
   
   Calculate the actual score by evaluating each criterion. A short draft might score 30-50, a decent document 60-75, a polished document 80-95.

2. Between 3-5 specific suggestions the user can accept or reject

Each suggestion MUST specify an "action" type:

1. **"add"** - Add new content to the document
   - Use "content" field with the text to add

2. **"replace"** - Replace existing text with improved text
   - Use "find" field with the EXACT text to find (copy exactly from document)
   - Use "replace" field with the new text

3. **"delete"** - Remove text that shouldn't be there
   - Use "find" field with the EXACT text to delete (copy exactly from document)

Return ONLY this JSON format:
{
  "score": <number 0-100>,
  "suggestions": [
    {
      "type": "grammar|clarity|structure|completeness|style",
      "action": "add|replace|delete",
      "title": "Brief description of the change",
      "reason": "Why this improves the document",
      "content": "Text to add (only for action=add)",
      "find": "Exact text to find (only for action=replace or delete)",
      "replace": "Replacement text (only for action=replace)"
    }
  ]
}

CRITICAL RULES:
- Return ONLY raw JSON. Do NOT wrap in markdown code fences.
- For "replace" and "delete" actions, the "find" field MUST contain text that EXACTLY matches text in the document
- For "replace" and "delete", "find" MUST be a SHORT excerpt copied exactly from the document (recommended 80-300 characters). NEVER include entire sections or the whole document.
- For "replace", "replace" must correspond only to that excerpt (i.e., you're editing a specific small piece, not rewriting large chunks).
- For "add" action, provide high-quality ready-to-use content
- Do NOT include fields that aren't needed for the action type`;

        const startTime = Date.now();
        
        let aiResponse;
        try {
          aiResponse = await generateTextClaude({
            prompt,
            model: 'claude-sonnet-4.5',
            maxTokens: 2000,
            temperature: 0.0,
          });
        } catch (aiError) {
          request.log.error(
            {
              documentId: validated.document_id,
              error: aiError instanceof Error ? aiError.message : 'Unknown AI error',
              stack: aiError instanceof Error ? aiError.stack : undefined,
            },
            'AI generation failed'
          );
          throw aiError;
        }

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
          const text = aiResponse.content || '';

          const tryParseJson = (raw: string): any => {
            try {
              return JSON.parse(raw);
            } catch {
              const withoutTrailingCommas = raw.replace(/,(\s*[}\]])/g, '$1');
              return JSON.parse(withoutTrailingCommas);
            }
          };

          const extractJsonCandidates = (raw: string): string[] => {
            const candidates: string[] = [];

            const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
            let fenceMatch: RegExpExecArray | null;
            while ((fenceMatch = fenceRegex.exec(raw)) !== null) {
              if (fenceMatch[1]) candidates.push(fenceMatch[1].trim());
            }

            // If the model started a JSON code fence but got truncated, try the remainder
            const fenceStart = raw.match(/```(?:json)?\s*/i);
            if (fenceStart) {
              const startIdx = raw.toLowerCase().indexOf('```');
              const afterFence = raw.slice(startIdx).replace(/```(?:json)?\s*/i, '').trim();
              if (afterFence.startsWith('{')) {
                candidates.push(afterFence);
              }
            }

            // If the response begins with a JSON object but is truncated, still try to parse it
            const trimmed = raw.trimStart();
            if (trimmed.startsWith('{')) {
              candidates.push(trimmed);
            }

            let start = -1;
            let depth = 0;
            let inString = false;
            let escape = false;
            for (let i = 0; i < raw.length; i++) {
              const ch = raw[i];
              if (inString) {
                if (escape) {
                  escape = false;
                  continue;
                }
                if (ch === '\\') {
                  escape = true;
                  continue;
                }
                if (ch === '"') {
                  inString = false;
                }
                continue;
              }

              if (ch === '"') {
                inString = true;
                continue;
              }

              if (ch === '{') {
                if (depth === 0) start = i;
                depth++;
              } else if (ch === '}') {
                if (depth > 0) depth--;
                if (depth === 0 && start !== -1) {
                  candidates.push(raw.slice(start, i + 1));
                  start = -1;
                }
              }
            }

            return candidates.map(c => c.trim()).filter(Boolean);
          };

          const normalizeEnhanceResult = (parsed: any): EnhanceResponse => {
            const root = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
            const scoreRaw = root?.score;
            const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw);
            if (!Number.isFinite(score)) {
              throw new Error('Invalid score in AI response');
            }

            const suggestionsRaw = Array.isArray(root?.suggestions) ? root.suggestions : [];
            const suggestions = suggestionsRaw
              .filter((s: any) => s && typeof s === 'object')
              .map((s: any) => {
                const actionRaw = String(s.action || '').toLowerCase();
                const action = actionRaw === 'remove' ? 'delete' : actionRaw === 'insert' ? 'add' : actionRaw;
                const typeRaw = String(s.type || '').toLowerCase();
                const allowedTypes = new Set(['grammar', 'clarity', 'structure', 'completeness', 'style']);
                const type = allowedTypes.has(typeRaw) ? typeRaw : 'clarity';

                const find = s.find !== undefined ? String(s.find) : undefined;
                const replace = s.replace !== undefined ? String(s.replace) : undefined;

                // Guardrail: prevent giant payloads that cause truncated JSON responses
                // If the model violates the prompt and returns huge "find" blocks, drop the suggestion.
                const MAX_FIND_LEN = 600;
                const MAX_REPLACE_LEN = 1200;
                if ((action === 'replace' || action === 'delete') && find && find.length > MAX_FIND_LEN) {
                  return null;
                }
                if (action === 'replace' && replace && replace.length > MAX_REPLACE_LEN) {
                  return null;
                }

                return {
                  type,
                  action,
                  title: String(s.title || ''),
                  reason: String(s.reason || ''),
                  content: s.content !== undefined ? String(s.content) : undefined,
                  find,
                  replace,
                };
              })
              .filter((s: any) => s && ['add', 'replace', 'delete'].includes(s.action));

            if (suggestions.length === 0) {
              throw new Error('Invalid suggestions in AI response');
            }

            const limitedSuggestions = suggestions.slice(0, 5);
            return {
              score: Math.max(0, Math.min(100, Math.round(score))),
              suggestions: limitedSuggestions,
            };
          };

          const candidates = extractJsonCandidates(text);
          if (candidates.length === 0) {
            throw new Error('No JSON found in AI response');
          }

          let lastError: unknown;
          let parsed: any | null = null;
          for (const c of candidates) {
            try {
              const obj = tryParseJson(c);
              if (obj && typeof obj === 'object') {
                parsed = obj;
                break;
              }
            } catch (e) {
              lastError = e;
            }
          }

          if (!parsed) {
            throw lastError instanceof Error ? lastError : new Error('Failed to parse JSON');
          }

          enhanceResult = normalizeEnhanceResult(parsed);

          if (enhanceResult.score < 0 || enhanceResult.score > 100) {
            throw new Error('Invalid score in AI response');
          }
        } catch (parseError) {
          request.log.error(
            {
              documentId: validated.document_id,
              aiResponse: (aiResponse.content || '').slice(0, 4000),
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
              has_custom_prompt: !!validated.custom_prompt,
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

        // Save AI score to document
        const { error: scoreError } = await supabaseAdmin
          .from('documents')
          .update({ ai_score: enhanceResult.score })
          .eq('id', validated.document_id);

        if (scoreError) {
          request.log.error(
            {
              documentId: validated.document_id,
              error: scoreError.message,
            },
            'Failed to save AI score to document'
          );
          // Don't fail the request if score save fails
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
          success: true,
          data: {
            score: enhanceResult.score,
            suggestions: enhanceResult.suggestions,
            credits_used: creditsToDeduct,
            tokens_used: aiResponse.tokensInput + aiResponse.tokensOutput,
          },
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

  // POST /api/ai/enhance/lineage - Create lineage entry when suggestion is applied
  const ApplySuggestionSchema = z.object({
    document_id: z.string().uuid('Invalid document ID format'),
    suggestion_title: z.string(),
    suggestion_action: z.enum(['add', 'replace', 'delete']),
    suggestion_type: z.enum(['grammar', 'clarity', 'structure', 'completeness', 'style']),
  });

  fastify.post(
    '/api/ai/enhance/lineage',
    {
      preHandler: [tenantContextMiddleware, authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['document_id', 'suggestion_title', 'suggestion_action', 'suggestion_type'],
          properties: {
            document_id: { type: 'string', format: 'uuid' },
            suggestion_title: { type: 'string' },
            suggestion_action: { type: 'string', enum: ['add', 'replace', 'delete'] },
            suggestion_type: { type: 'string', enum: ['grammar', 'clarity', 'structure', 'completeness', 'style'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { tenant, user } = request as any;

      try {
        const validated = ApplySuggestionSchema.parse(request.body);

        // Verify document exists and belongs to tenant
        const { data: document, error: docError } = await supabaseAdmin
          .from('documents')
          .select('id, title')
          .eq('id', validated.document_id)
          .eq('tenant_id', tenant.id)
          .single();

        if (docError || !document) {
          return reply.status(404).send({
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Document not found',
            },
          });
        }

        // Create lineage entry for AI enhancement
        const { error: lineageError } = await supabaseAdmin
          .from('document_lineage')
          .insert({
            document_id: validated.document_id,
            event_type: 'ai_enhanced',
            actor_id: user.id,
            metadata: {
              suggestion_title: validated.suggestion_title,
              suggestion_action: validated.suggestion_action,
              suggestion_type: validated.suggestion_type,
            },
          });

        if (lineageError) {
          request.log.error(
            { error: lineageError, documentId: validated.document_id, userId: user.id },
            'Failed to create lineage event for AI enhancement'
          );
          return reply.status(500).send({
            error: {
              code: 'LINEAGE_CREATE_FAILED',
              message: 'Failed to record enhancement',
            },
          });
        }

        request.log.info(
          {
            documentId: validated.document_id,
            userId: user.id,
            action: validated.suggestion_action,
            type: validated.suggestion_type,
          },
          'AI enhancement suggestion applied'
        );

        return reply.status(200).send({
          success: true,
          data: {
            message: 'Enhancement applied and recorded',
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request parameters',
            },
          });
        }

        request.log.error(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'Error in AI enhance apply endpoint'
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
