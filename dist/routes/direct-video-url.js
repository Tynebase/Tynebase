"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = directVideoURLRoutes;
const zod_1 = require("zod");
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const creditGuard_1 = require("../middleware/creditGuard");
const dispatchJob_1 = require("../utils/dispatchJob");
const DirectVideoURLSchema = zod_1.z.object({
    url: zod_1.z.string().url('Invalid URL format'),
    output_options: zod_1.z.object({
        generate_transcript: zod_1.z.boolean().optional(),
        generate_summary: zod_1.z.boolean().optional(),
        generate_article: zod_1.z.boolean().optional(),
        ai_model: zod_1.z.enum(['deepseek', 'gemini', 'claude']).optional(),
    }).optional(),
});
/**
 * Direct Video URL Ingestion endpoint
 * POST /api/ai/video/url
 * Accepts any public video URL and dispatches processing job
 */
async function directVideoURLRoutes(fastify) {
    fastify.post('/api/ai/video/url', {
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
            const validationResult = DirectVideoURLSchema.safeParse(request.body);
            if (!validationResult.success) {
                const errorMessages = validationResult.error.errors
                    .map((e) => e.message)
                    .join(', ');
                request.log.warn({
                    body: request.body,
                    tenantId: tenant.id,
                    userId: user.id,
                    errors: errorMessages,
                }, 'Invalid video URL submitted');
                return reply.status(400).send({
                    error: {
                        code: 'INVALID_URL',
                        message: errorMessages,
                        details: validationResult.error.errors,
                    },
                });
            }
            const { url, output_options } = validationResult.data;
            const sanitizedUrl = url.trim();
            request.log.info({
                url: sanitizedUrl,
                tenantId: tenant.id,
                userId: user.id,
                outputOptions: output_options,
            }, 'Dispatching direct URL video ingestion job');
            const job = await (0, dispatchJob_1.dispatchJob)({
                tenantId: tenant.id,
                type: 'video_ingest_url',
                payload: {
                    url: sanitizedUrl,
                    user_id: user.id,
                    output_options: output_options || {
                        generate_transcript: true,
                        generate_summary: false,
                        generate_article: false,
                        ai_model: 'gemini',
                    },
                },
            });
            request.log.info({
                jobId: job.id,
                url: sanitizedUrl,
                tenantId: tenant.id,
                userId: user.id,
            }, 'Direct URL video ingestion job dispatched');
            return reply.status(201).send({
                job,
            });
        }
        catch (error) {
            request.log.error({
                tenantId: tenant.id,
                userId: user?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Error in direct video URL endpoint');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while processing your request',
                },
            });
        }
    });
}
//# sourceMappingURL=direct-video-url.js.map