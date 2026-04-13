"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = aiGenerateRoutes;
const zod_1 = require("zod");
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const creditGuard_1 = require("../middleware/creditGuard");
const supabase_1 = require("../lib/supabase");
const dispatchJob_1 = require("../utils/dispatchJob");
const creditCalculator_1 = require("../utils/creditCalculator");
const notifications_1 = require("../services/notifications");
/**
 * Model credit costs for AI generation:
 * - deepseek: 1 credit (default, most economical)
 * - gemini: 2 credits (good balance)
 * - claude: 5 credits (highest quality)
 */
const GenerateRequestSchema = zod_1.z.object({
    prompt: zod_1.z.string()
        .min(10, 'Prompt must be at least 10 characters')
        .max(10000, 'Prompt must not exceed 10,000 characters'),
    model: zod_1.z.enum(['deepseek', 'claude', 'gemini'])
        .optional()
        .default('deepseek'),
    max_tokens: zod_1.z.number()
        .int()
        .min(100)
        .max(8000)
        .optional()
        .default(8000),
    output_types: zod_1.z.array(zod_1.z.enum(['full_article', 'summary', 'outline', 'with_template']))
        .min(1, 'At least one output type is required')
        .max(4)
        .optional()
        .default(['full_article']),
    template_content: zod_1.z.string()
        .max(50000)
        .optional(),
    skip_document_creation: zod_1.z.boolean()
        .optional()
        .default(false),
});
/**
 * AI Generate endpoint for creating documents from prompts
 * POST /api/ai/generate
 */
async function aiGenerateRoutes(fastify) {
    fastify.post('/api/ai/generate', {
        preHandler: [
            rateLimit_1.rateLimitMiddleware,
            tenantContext_1.tenantContextMiddleware,
            auth_1.authMiddleware,
            creditGuard_1.creditGuardMiddleware,
        ],
    }, async (request, reply) => {
        const tenant = request.tenant;
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
            const { data: consent, error: consentError } = await supabase_1.supabaseAdmin
                .from('user_consents')
                .select('ai_processing')
                .eq('user_id', user.id)
                .single();
            if (consentError && consentError.code !== 'PGRST116') {
                request.log.error({
                    userId: user.id,
                    error: consentError.message,
                }, 'Failed to check user consent');
                return reply.status(500).send({
                    error: {
                        code: 'CONSENT_CHECK_FAILED',
                        message: 'Unable to verify consent preferences',
                    },
                });
            }
            if (consent && consent.ai_processing === false) {
                request.log.warn({
                    userId: user.id,
                    tenantId: tenant.id,
                }, 'User has not consented to AI processing');
                return reply.status(403).send({
                    error: {
                        code: 'CONSENT_REQUIRED',
                        message: 'AI processing consent is required. Please update your privacy settings.',
                    },
                });
            }
            // Get credit cost based on model × number of output types
            const modelCost = (0, creditCalculator_1.getModelCreditCost)(validated.model);
            const creditsToDeduct = modelCost * validated.output_types.length;
            request.log.info({
                tenantId: tenant.id,
                userId: user.id,
                credits: creditsToDeduct,
                model: validated.model,
            }, 'Deducting credits for AI generation');
            const currentMonth = new Date().toISOString().slice(0, 7);
            const { data: deductResult, error: deductError } = await supabase_1.supabaseAdmin.rpc('deduct_credits', {
                p_tenant_id: tenant.id,
                p_credits: creditsToDeduct,
                p_month_year: currentMonth,
            });
            if (deductError) {
                request.log.error({
                    tenantId: tenant.id,
                    error: deductError.message,
                }, 'Failed to deduct credits');
                return reply.status(500).send({
                    error: {
                        code: 'CREDIT_DEDUCTION_FAILED',
                        message: 'Unable to deduct credits for this operation',
                    },
                });
            }
            if (!deductResult || deductResult.length === 0 || !deductResult[0].success) {
                const errorMessage = deductResult?.[0]?.error_message || 'Insufficient credits';
                request.log.warn({
                    tenantId: tenant.id,
                    creditsToDeduct,
                    errorMessage,
                }, 'Credit deduction failed');
                return reply.status(403).send({
                    error: {
                        code: 'INSUFFICIENT_CREDITS',
                        message: errorMessage,
                    },
                });
            }
            const job = await (0, dispatchJob_1.dispatchJob)({
                tenantId: tenant.id,
                type: 'ai_generation',
                payload: {
                    prompt: validated.prompt,
                    model: validated.model,
                    max_tokens: validated.max_tokens,
                    output_types: validated.output_types,
                    template_content: validated.template_content,
                    user_id: user.id,
                    estimated_credits: creditsToDeduct,
                    skip_document_creation: validated.skip_document_creation,
                },
            });
            request.log.info({
                jobId: job.id,
                tenantId: tenant.id,
                userId: user.id,
                creditsDeducted: creditsToDeduct,
            }, 'AI generation job dispatched successfully');
            // Check remaining credits and notify if low (fire-and-forget)
            (async () => {
                try {
                    const { data: creditData } = await supabase_1.supabaseAdmin
                        .from('credit_pools')
                        .select('total_credits, used_credits')
                        .eq('tenant_id', tenant.id)
                        .eq('month_year', currentMonth)
                        .single();
                    if (creditData) {
                        const remaining = Number(creditData.total_credits) - Number(creditData.used_credits);
                        const total = Number(creditData.total_credits);
                        if (remaining <= 0) {
                            await (0, notifications_1.notifyCreditsExhausted)({ userId: user.id, tenantId: tenant.id });
                        }
                        else if (remaining <= Math.max(3, total * 0.1)) {
                            await (0, notifications_1.notifyCreditsLow)({ userId: user.id, tenantId: tenant.id, creditsRemaining: remaining, creditsTotal: total });
                        }
                    }
                }
                catch (err) {
                    request.log.error({ err }, 'Failed to check/notify credit levels');
                }
            })();
            return reply.status(202).send({
                success: true,
                data: {
                    job: {
                        id: job.id,
                        tenant_id: job.tenant_id,
                        type: job.type,
                        status: job.status,
                        payload: job.payload,
                        result: null,
                        error_message: null,
                        progress: 0,
                        created_at: job.created_at,
                        started_at: null,
                        completed_at: null,
                    },
                },
                message: 'Generation job queued successfully',
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
                return reply.status(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Invalid request: ${errorMessages.join('; ')}`,
                        details: errorMessages,
                    },
                });
            }
            request.log.error({
                tenantId: tenant.id,
                userId: user?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Error in AI generate endpoint');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while processing your request',
                },
            });
        }
    });
}
//# sourceMappingURL=ai-generate.js.map