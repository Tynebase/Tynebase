"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = knowledgeActivityRoutes;
const zod_1 = require("zod");
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const membershipGuard_1 = require("../middleware/membershipGuard");
const supabase_1 = require("../lib/supabase");
/**
 * Valid activity types from the lineage_event_type enum
 */
const ACTIVITY_TYPES = [
    'created',
    'ai_generated',
    'converted_from_video',
    'converted_from_pdf',
    'converted_from_docx',
    'converted_from_url',
    'published',
    'unpublished',
    'ai_enhanced',
    'edited',
];
/**
 * Query parameters schema for GET /api/knowledge/activity
 */
const activityQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    type: zod_1.z.enum(ACTIVITY_TYPES).optional(),
    search: zod_1.z.string().max(200).optional(),
    actor_id: zod_1.z.string().uuid().optional(),
    document_id: zod_1.z.string().uuid().optional(),
    from_date: zod_1.z.string().datetime().optional(),
    to_date: zod_1.z.string().datetime().optional(),
});
/**
 * Generate a human-readable detail string from activity metadata
 */
function generateActivityDetail(eventType, metadata) {
    switch (eventType) {
        case 'created':
            return 'Created new document';
        case 'ai_generated':
            return metadata.model
                ? `Generated with ${metadata.model}`
                : 'Generated with AI';
        case 'converted_from_video':
            return metadata.source_url
                ? `Converted from video: ${metadata.source_url}`
                : 'Converted from video';
        case 'converted_from_pdf':
            return metadata.file_name
                ? `Converted from PDF: ${metadata.file_name}`
                : 'Converted from PDF';
        case 'converted_from_docx':
            return metadata.file_name
                ? `Converted from DOCX: ${metadata.file_name}`
                : 'Converted from DOCX';
        case 'converted_from_url':
            return metadata.source_url
                ? `Imported from: ${metadata.source_url}`
                : 'Imported from URL';
        case 'published':
            return metadata.version
                ? `Published v${metadata.version}`
                : 'Published';
        case 'unpublished':
            return 'Unpublished';
        case 'ai_enhanced':
            return metadata.enhancement_type
                ? `AI enhanced: ${metadata.enhancement_type}`
                : 'Enhanced with AI';
        case 'edited':
            return metadata.change_summary
                ? String(metadata.change_summary)
                : 'Edited document';
        default:
            return null;
    }
}
/**
 * Knowledge Activity routes
 *
 * GET /api/knowledge/activity - List activity feed with pagination and filtering
 */
async function knowledgeActivityRoutes(fastify) {
    /**
     * GET /api/knowledge/activity
     *
     * Query Parameters:
     * - page (optional): Page number (default: 1)
     * - limit (optional): Items per page (default: 20, max: 100)
     * - type (optional): Filter by activity type
     * - search (optional): Search in document titles and actor names
     * - actor_id (optional): Filter by actor UUID
     * - document_id (optional): Filter by document UUID
     * - from_date (optional): Filter activities from this date (ISO 8601)
     * - to_date (optional): Filter activities until this date (ISO 8601)
     *
     * Authorization:
     * - Requires valid JWT
     * - User must be member of tenant
     */
    fastify.get('/api/knowledge/activity', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            // Parse and validate query parameters
            const query = activityQuerySchema.parse(request.query);
            const { page, limit, type, search, actor_id, document_id, from_date, to_date } = query;
            // Calculate offset for pagination
            const offset = (page - 1) * limit;
            // Build base query for counting
            let countQuery = supabase_1.supabaseAdmin
                .from('document_lineage')
                .select('id, documents!inner(tenant_id)', { count: 'exact', head: true })
                .eq('documents.tenant_id', tenant.id);
            // Build base query for fetching data
            let dataQuery = supabase_1.supabaseAdmin
                .from('document_lineage')
                .select(`
            id,
            event_type,
            created_at,
            actor_id,
            metadata,
            document_id,
            documents!inner(id, title, tenant_id),
            users(id, full_name, email)
          `)
                .eq('documents.tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            // Apply filters
            if (type) {
                countQuery = countQuery.eq('event_type', type);
                dataQuery = dataQuery.eq('event_type', type);
            }
            if (actor_id) {
                countQuery = countQuery.eq('actor_id', actor_id);
                dataQuery = dataQuery.eq('actor_id', actor_id);
            }
            if (document_id) {
                countQuery = countQuery.eq('document_id', document_id);
                dataQuery = dataQuery.eq('document_id', document_id);
            }
            if (from_date) {
                countQuery = countQuery.gte('created_at', from_date);
                dataQuery = dataQuery.gte('created_at', from_date);
            }
            if (to_date) {
                countQuery = countQuery.lte('created_at', to_date);
                dataQuery = dataQuery.lte('created_at', to_date);
            }
            // Execute both queries in parallel
            const [countResult, dataResult] = await Promise.all([
                countQuery,
                dataQuery,
            ]);
            if (countResult.error) {
                fastify.log.error({ error: countResult.error, tenantId: tenant.id }, 'Failed to count activities');
                return reply.code(500).send({
                    error: {
                        code: 'QUERY_FAILED',
                        message: 'Failed to retrieve activity count',
                        details: {},
                    },
                });
            }
            if (dataResult.error) {
                fastify.log.error({ error: dataResult.error, tenantId: tenant.id }, 'Failed to fetch activities');
                return reply.code(500).send({
                    error: {
                        code: 'QUERY_FAILED',
                        message: 'Failed to retrieve activities',
                        details: {},
                    },
                });
            }
            const total = countResult.count || 0;
            const activities = (dataResult.data || [])
                .map((item) => {
                const actorName = item.users?.full_name ||
                    item.users?.email?.split('@')[0] ||
                    (item.actor_id ? 'Unknown User' : 'System');
                return {
                    id: item.id,
                    type: item.event_type,
                    actor: {
                        id: item.actor_id,
                        name: actorName,
                        email: item.users?.email || null,
                    },
                    target: {
                        id: item.documents?.id || item.document_id,
                        title: item.documents?.title || 'Unknown Document',
                    },
                    detail: generateActivityDetail(item.event_type, item.metadata || {}),
                    metadata: item.metadata || {},
                    created_at: item.created_at,
                };
            })
                // Apply search filter in-memory (Supabase doesn't support OR across joined tables easily)
                .filter((activity) => {
                if (!search)
                    return true;
                const searchLower = search.toLowerCase();
                return (activity.actor.name.toLowerCase().includes(searchLower) ||
                    activity.target.title.toLowerCase().includes(searchLower) ||
                    (activity.detail?.toLowerCase().includes(searchLower) ?? false));
            });
            // Recalculate total if search was applied
            const filteredTotal = search ? activities.length : total;
            const totalPages = Math.ceil(filteredTotal / limit);
            fastify.log.info({
                tenantId: tenant.id,
                userId: user.id,
                page,
                limit,
                total: filteredTotal,
                filters: { type, search, actor_id, document_id, from_date, to_date },
            }, 'Knowledge activity retrieved successfully');
            return reply.code(200).send({
                success: true,
                data: {
                    activities,
                    pagination: {
                        page,
                        limit,
                        total: filteredTotal,
                        total_pages: totalPages,
                        has_next: page < totalPages,
                        has_prev: page > 1,
                    },
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid query parameters',
                        details: error.errors,
                    },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in GET /api/knowledge/activity');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * GET /api/knowledge/activity/types
     * Returns available activity types for filtering
     */
    fastify.get('/api/knowledge/activity/types', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (_request, reply) => {
        return reply.code(200).send({
            success: true,
            data: {
                types: ACTIVITY_TYPES.map((type) => ({
                    value: type,
                    label: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                })),
            },
        });
    });
}
//# sourceMappingURL=knowledge-activity.js.map