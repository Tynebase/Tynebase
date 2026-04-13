"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = youtubeVideoRoutes;
const zod_1 = require("zod");
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const creditGuard_1 = require("../middleware/creditGuard");
const dispatchJob_1 = require("../utils/dispatchJob");
const YouTubeURLSchema = zod_1.z.object({
    url: zod_1.z.string().url('Invalid URL format').refine((url) => {
        // More permissive regex that accepts:
        // - youtube.com/watch?v=ID
        // - youtu.be/ID
        // - youtube.com/embed/ID
        // - youtube.com/shorts/ID
        // - youtube.com/v/ID
        // - URLs with additional parameters
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]+(\S*)?$/;
        return youtubeRegex.test(url);
    }, {
        message: 'Invalid YouTube URL format. Must be a valid YouTube video URL.',
    }),
    output_options: zod_1.z.object({
        generate_transcript: zod_1.z.boolean().optional(),
        generate_summary: zod_1.z.boolean().optional(),
        generate_article: zod_1.z.boolean().optional(),
        ai_model: zod_1.z.enum(['deepseek', 'gemini', 'claude']).optional(),
    }).optional(),
});
/**
 * YouTube Video Ingestion endpoint
 * POST /api/ai/video/youtube
 * Accepts YouTube URL and dispatches processing job
 */
async function youtubeVideoRoutes(fastify) {
    fastify.post('/api/ai/video/youtube', {
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
            const validationResult = YouTubeURLSchema.safeParse(request.body);
            if (!validationResult.success) {
                const errorMessages = validationResult.error.errors
                    .map((e) => e.message)
                    .join(', ');
                request.log.warn({
                    body: request.body,
                    tenantId: tenant.id,
                    userId: user.id,
                    errors: errorMessages,
                }, 'Invalid YouTube URL submitted');
                return reply.status(400).send({
                    error: {
                        code: 'INVALID_URL',
                        message: errorMessages,
                        details: validationResult.error.errors,
                    },
                });
            }
            const { url } = validationResult.data;
            const sanitizedUrl = url.trim();
            request.log.info({
                url: sanitizedUrl,
                tenantId: tenant.id,
                userId: user.id,
            }, 'Dispatching YouTube video ingestion job');
            const { output_options } = validationResult.data;
            const job = await (0, dispatchJob_1.dispatchJob)({
                tenantId: tenant.id,
                type: 'video_ingest_youtube',
                payload: {
                    youtube_url: sanitizedUrl,
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
            }, 'YouTube video ingestion job dispatched');
            return reply.status(201).send({
                job,
            });
        }
        catch (error) {
            request.log.error({
                tenantId: tenant.id,
                userId: user?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Error in YouTube video endpoint');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while processing your request',
                },
            });
        }
    });
}
//# sourceMappingURL=youtube-video.js.map