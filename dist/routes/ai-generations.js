"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = recentGenerationsRoutes;
const zod_1 = require("zod");
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../lib/supabase");
const ListRecentGenerationsQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
    status: zod_1.z.enum(['pending', 'processing', 'completed', 'failed', 'all']).default('all'),
});
/**
 * Recent AI Generations listing endpoint
 * GET /api/ai/generations
 * Lists recent AI generation jobs for the tenant
 */
async function recentGenerationsRoutes(fastify) {
    fastify.get('/api/ai/generations', {
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
            const query = ListRecentGenerationsQuerySchema.parse(request.query);
            const { limit, offset, status } = query;
            // Build query for AI generation jobs
            let jobQuery = supabase_1.supabaseAdmin
                .from('job_queue')
                .select('id, tenant_id, type, status, payload, result, created_at, started_at, completed_at')
                .eq('tenant_id', tenant.id)
                .in('type', ['ai_generation', 'generate', 'scrape', 'enhance', 'enhance_apply', 'legal_document_process', 'legal_document_upload', 'video_transcribe_to_document'])
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            // Filter by status
            if (status !== 'all') {
                jobQuery = jobQuery.eq('status', status);
            }
            const { data: jobs, error: jobError } = await jobQuery;
            if (jobError) {
                request.log.error({
                    tenantId: tenant.id,
                    error: jobError.message,
                }, 'Failed to fetch recent generations');
                return reply.status(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Unable to retrieve recent generations',
                    },
                });
            }
            // Get total count for pagination
            let countQuery = supabase_1.supabaseAdmin
                .from('job_queue')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .in('type', ['ai_generation', 'generate', 'scrape', 'enhance', 'enhance_apply', 'legal_document_process', 'legal_document_upload', 'video_transcribe_to_document']);
            if (status !== 'all') {
                countQuery = countQuery.eq('status', status);
            }
            const { count: totalCount } = await countQuery;
            // Transform jobs for frontend
            const transformedJobs = jobs?.map((job) => {
                const payload = job.payload;
                const result = job.result;
                // Determine generation type from job type
                let type = 'From Prompt';
                if (job.type === 'scrape') {
                    type = 'From URL';
                }
                else if (job.type === 'legal_document_process' || job.type === 'legal_document_upload') {
                    type = 'From File';
                }
                else if (job.type === 'enhance' || job.type === 'enhance_apply') {
                    type = 'Enhance';
                }
                else if (job.type === 'video_transcribe_to_document') {
                    type = 'From File';
                }
                // Extract title from result or payload
                let title = result?.title ||
                    result?.document_title ||
                    payload?.original_filename ||
                    payload?.prompt?.slice(0, 50) ||
                    'Untitled Generation';
                if (payload?.url && !title) {
                    title = `Scraped: ${payload.url}`;
                }
                return {
                    id: job.id,
                    title: title.length > 50 ? title.slice(0, 50) + '...' : title,
                    type,
                    status: job.status,
                    created_at: job.created_at,
                    document_id: result?.document_id || null,
                };
            }) || [];
            // Filter out generations whose linked document has been deleted
            const documentIds = transformedJobs
                .map((j) => j.document_id)
                .filter((id) => id !== null);
            let existingDocIds = new Set();
            if (documentIds.length > 0) {
                const { data: existingDocs } = await supabase_1.supabaseAdmin
                    .from('documents')
                    .select('id')
                    .in('id', documentIds);
                existingDocIds = new Set((existingDocs || []).map((d) => d.id));
            }
            const filteredJobs = transformedJobs.filter((job) => job.document_id === null || existingDocIds.has(job.document_id));
            request.log.info({
                tenantId: tenant.id,
                userId: user.id,
                jobCount: transformedJobs.length,
            }, 'Recent generations retrieved successfully');
            return reply.status(200).send({
                generations: filteredJobs,
                total: totalCount || 0,
                limit,
                offset,
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
                return reply.status(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request parameters',
                        details: errorMessages,
                    },
                });
            }
            request.log.error({
                tenantId: tenant.id,
                userId: user?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Error in recent generations endpoint');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while processing your request',
                },
            });
        }
    });
}
//# sourceMappingURL=ai-generations.js.map