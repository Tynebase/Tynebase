"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = videoTranscribeToDocumentRoutes;
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../lib/supabase");
const dispatchJob_1 = require("../utils/dispatchJob");
const zod_1 = require("zod");
const creditCalculator_1 = require("../utils/creditCalculator");
const VideoTranscribeRequestSchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid(),
    video_url: zod_1.z.string().url(),
    video_type: zod_1.z.enum(['youtube', 'uploaded']),
    output_options: zod_1.z.object({
        generate_transcript: zod_1.z.boolean(),
        generate_summary: zod_1.z.boolean(),
        generate_article: zod_1.z.boolean(),
        append_to_document: zod_1.z.boolean(),
        ai_model: zod_1.z.string(),
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
async function videoTranscribeToDocumentRoutes(fastify) {
    fastify.post('/api/documents/:id/transcribe-video', {
        preHandler: [
            rateLimit_1.rateLimitMiddleware,
            tenantContext_1.tenantContextMiddleware,
            auth_1.authMiddleware,
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
            const documentId = request.params.id;
            const validated = VideoTranscribeRequestSchema.parse({
                document_id: documentId,
                video_url: request.body.video_url,
                video_type: request.body.video_type,
                output_options: request.body.output_options,
            });
            // Check if document exists and user has access
            const { data: document, error: docError } = await supabase_1.supabaseAdmin
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
            const modelCost = (0, creditCalculator_1.getModelCreditCost)(aiModel);
            const REQUIRED_CREDITS = BASE_CREDITS +
                (outputOptions.generate_summary ? modelCost : 0) +
                (outputOptions.generate_article ? modelCost : 0);
            const currentMonth = new Date().toISOString().slice(0, 7);
            const { data: creditData, error: creditError } = await supabase_1.supabaseAdmin
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
            request.log.info({
                documentId: validated.document_id,
                videoUrl: validated.video_url,
                videoType: validated.video_type,
                tenantId: tenant.id,
                userId: user.id,
                outputOptions,
            }, 'Starting video transcription to document');
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
            const job = await (0, dispatchJob_1.dispatchJob)({
                tenantId: tenant.id,
                type: 'video_transcribe_to_document',
                payload: jobPayload,
            });
            request.log.info({
                jobId: job.id,
                documentId: validated.document_id,
                videoUrl: validated.video_url,
                tenantId: tenant.id,
                userId: user.id,
            }, 'Video transcription job dispatched');
            return reply.status(202).send({
                message: 'Video transcription started',
                job_id: job.id,
                document_id: validated.document_id,
                video_url: validated.video_url,
                credits_charged: REQUIRED_CREDITS,
                status: 'processing',
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: error.errors.map(e => e.message).join(', '),
                    },
                });
            }
            request.log.error({
                tenantId: tenant.id,
                userId: user?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Error in video transcribe to document endpoint');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while processing your request',
                },
            });
        }
    });
}
//# sourceMappingURL=video-transcribe-to-document.js.map