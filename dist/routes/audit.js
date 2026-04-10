"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = auditRoutes;
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const membershipGuard_1 = require("../middleware/membershipGuard");
const rateLimit_1 = require("../middleware/rateLimit");
/**
 * Query schema for audit stats
 */
const auditStatsQuerySchema = zod_1.z.object({
    days: zod_1.z.coerce.number().int().min(7).max(365).default(30),
});
/**
 * Query schema for stale documents
 */
const staleDocsQuerySchema = zod_1.z.object({
    days: zod_1.z.coerce.number().int().min(30).max(365).default(90),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
/**
 * Query schema for review queue
 */
const reviewQueueQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'all']).default('pending'),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
/**
 * Query schema for top performers
 */
const topPerformersQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(20).default(5),
    days: zod_1.z.coerce.number().int().min(7).max(365).default(30),
});
/**
 * Query schema for audit logs listing
 */
const auditLogsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    action_type: zod_1.z.enum(['all', 'document', 'user', 'auth', 'settings']).default('all'),
    search: zod_1.z.string().optional(),
});
/**
 * Schema for creating a document review
 */
const createReviewBodySchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid(),
    reason: zod_1.z.string().min(1).max(500),
    priority: zod_1.z.enum(['low', 'medium', 'high']).default('medium'),
    due_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    assigned_to: zod_1.z.string().uuid().optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
/**
 * Schema for updating a document review
 */
const updateReviewBodySchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high']).optional(),
    due_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    assigned_to: zod_1.z.string().uuid().nullable().optional(),
    notes: zod_1.z.string().max(2000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
});
/**
 * Audit routes for content health monitoring and review management
 */
async function auditRoutes(fastify) {
    /**
     * GET /api/audit/logs
     * Returns paginated audit logs with filtering and search
     */
    fastify.get('/api/audit/logs', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const query = auditLogsQuerySchema.parse(request.query);
            const { page, limit, action_type, search } = query;
            const offset = (page - 1) * limit;
            // Build the query
            let dbQuery = supabase_1.supabaseAdmin
                .from('audit_logs')
                .select(`
            id,
            action,
            action_type,
            target_name,
            ip_address,
            metadata,
            created_at,
            actor:actor_id (
              id,
              full_name,
              email
            )
          `, { count: 'exact' })
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            // Apply action type filter
            if (action_type !== 'all') {
                dbQuery = dbQuery.eq('action_type', action_type);
            }
            // Apply search filter
            if (search && search.trim()) {
                const searchTerm = `%${search.trim()}%`;
                dbQuery = dbQuery.or(`target_name.ilike.${searchTerm},action.ilike.${searchTerm}`);
            }
            const { data: logs, error, count } = await dbQuery;
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch audit logs');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch audit logs',
                        details: {},
                    },
                });
            }
            // Format logs for frontend
            const formattedLogs = (logs || []).map((log) => ({
                id: log.id,
                action: log.action,
                actor: {
                    name: log.actor?.full_name || 'Unknown User',
                    email: log.actor?.email || '',
                    avatar: log.actor?.full_name
                        ? log.actor.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                        : 'UN',
                },
                target: log.target_name,
                timestamp: log.created_at,
                ip: log.ip_address || 'N/A',
                type: log.action_type,
                details: log.metadata || {},
            }));
            fastify.log.info({ tenantId: tenant.id, userId: user.id, count: formattedLogs.length, page }, 'Audit logs fetched successfully');
            return reply.code(200).send({
                success: true,
                data: {
                    logs: formattedLogs,
                    pagination: {
                        page,
                        limit,
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit),
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
            fastify.log.error({ error }, 'Unexpected error in GET /api/audit/logs');
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
     * GET /api/audit/logs/export
     * Exports audit logs as CSV file
     */
    fastify.get('/api/audit/logs/export', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const query = auditLogsQuerySchema.parse(request.query);
            const { action_type, search } = query;
            // Build the query - fetch all logs matching filters (no pagination for export)
            let dbQuery = supabase_1.supabaseAdmin
                .from('audit_logs')
                .select(`
            id,
            action,
            action_type,
            target_name,
            ip_address,
            metadata,
            created_at,
            actor:actor_id (
              id,
              full_name,
              email
            )
          `)
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(10000); // Reasonable limit for export
            // Apply action type filter
            if (action_type !== 'all') {
                dbQuery = dbQuery.eq('action_type', action_type);
            }
            // Apply search filter
            if (search && search.trim()) {
                const searchTerm = `%${search.trim()}%`;
                dbQuery = dbQuery.or(`target_name.ilike.${searchTerm},action.ilike.${searchTerm}`);
            }
            const { data: logs, error } = await dbQuery;
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch audit logs for export');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch audit logs for export',
                        details: {},
                    },
                });
            }
            // Generate CSV content
            const csvRows = [];
            // CSV Header
            csvRows.push('Timestamp,Action,Action Type,Actor Name,Actor Email,Target,IP Address,Details');
            // CSV Data
            (logs || []).forEach((log) => {
                const timestamp = new Date(log.created_at).toISOString();
                const action = log.action || '';
                const actionType = log.action_type || '';
                const actorName = log.actor?.full_name || 'Unknown User';
                const actorEmail = log.actor?.email || '';
                const target = log.target_name || '';
                const ipAddress = log.ip_address || 'N/A';
                const details = JSON.stringify(log.metadata || {}).replace(/"/g, '""'); // Escape quotes
                // Escape CSV fields that contain commas, quotes, or newlines
                const escapeCSV = (field) => {
                    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                        return `"${field}"`;
                    }
                    return field;
                };
                csvRows.push([
                    escapeCSV(timestamp),
                    escapeCSV(action),
                    escapeCSV(actionType),
                    escapeCSV(actorName),
                    escapeCSV(actorEmail),
                    escapeCSV(target),
                    escapeCSV(ipAddress),
                    escapeCSV(details)
                ].join(','));
            });
            const csvContent = csvRows.join('\n');
            const filename = `audit-logs-${tenant.subdomain}-${new Date().toISOString().split('T')[0]}.csv`;
            fastify.log.info({ tenantId: tenant.id, userId: user.id, count: logs?.length || 0 }, 'Audit logs exported successfully');
            return reply
                .code(200)
                .header('Content-Type', 'text/csv; charset=utf-8')
                .header('Content-Disposition', `attachment; filename="${filename}"`)
                .send(csvContent);
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
            fastify.log.error({ error }, 'Unexpected error in GET /api/audit/logs/export');
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
     * GET /api/audit/stats
     * Returns content health statistics for the audit dashboard
     */
    fastify.get('/api/audit/stats', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const query = auditStatsQuerySchema.parse(request.query);
            const { days } = query;
            // Get content health stats using the database function
            const { data: healthStats, error: statsError } = await supabase_1.supabaseAdmin
                .rpc('get_content_health_stats', {
                tenant_id_param: tenant.id,
                days_threshold: days,
            });
            if (statsError) {
                fastify.log.error({ error: statsError, tenantId: tenant.id }, 'Failed to fetch content health stats');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch content health stats',
                        details: {},
                    },
                });
            }
            const stats = healthStats?.[0] || {
                total_documents: 0,
                published_documents: 0,
                draft_documents: 0,
                stale_documents: 0,
                needs_review: 0,
                excellent_health: 0,
                good_health: 0,
                review_needed: 0,
                poor_health: 0,
            };
            // Calculate content health percentage
            const totalDocs = Number(stats.total_documents) || 0;
            const excellentDocs = Number(stats.excellent_health) || 0;
            const goodDocs = Number(stats.good_health) || 0;
            const healthPercentage = totalDocs > 0
                ? Math.round(((excellentDocs + goodDocs) / totalDocs) * 100)
                : 0;
            // Get documents created this month for "change" stat
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const { count: docsThisMonth } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .gte('created_at', startOfMonth.toISOString())
                .not('content', 'like', '__CATEGORY__%');
            // Get previous period health stats to compute a real trend
            const { data: prevHealthStats } = await supabase_1.supabaseAdmin
                .rpc('get_content_health_stats', {
                tenant_id_param: tenant.id,
                days_threshold: days * 2,
            });
            const prevStats = prevHealthStats?.[0] || {};
            const prevTotal = Number(prevStats.total_documents) || 0;
            const prevExcellent = Number(prevStats.excellent_health) || 0;
            const prevGood = Number(prevStats.good_health) || 0;
            const prevHealthPct = prevTotal > 0
                ? Math.round(((prevExcellent + prevGood) / prevTotal) * 100)
                : 0;
            const healthDelta = healthPercentage - prevHealthPct;
            const healthChangeText = healthDelta === 0
                ? 'No change'
                : `${healthDelta > 0 ? '+' : ''}${healthDelta}% vs prev period`;
            // Get reviews due this week
            const endOfWeek = new Date();
            endOfWeek.setDate(endOfWeek.getDate() + 7);
            const { count: reviewsDueThisWeek } = await supabase_1.supabaseAdmin
                .from('document_reviews')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('status', 'pending')
                .lte('due_date', endOfWeek.toISOString().split('T')[0]);
            // Count stale docs in previous period to compute trend
            const prevStale = Number(prevStats.stale_documents) || 0;
            const staleDelta = (Number(stats.stale_documents) || 0) - prevStale;
            const staleChangeText = staleDelta === 0
                ? `${days}+ days old`
                : staleDelta > 0
                    ? `+${staleDelta} since last period`
                    : `${staleDelta} since last period`;
            fastify.log.info({ tenantId: tenant.id, userId: user.id, days }, 'Content audit stats fetched successfully');
            return reply.code(200).send({
                success: true,
                data: {
                    stats: {
                        content_health: {
                            value: `${healthPercentage}%`,
                            change: healthChangeText,
                            positive: healthDelta >= 0,
                        },
                        total_documents: {
                            value: totalDocs,
                            change: `${docsThisMonth || 0} this month`,
                            positive: true,
                        },
                        needs_review: {
                            value: Number(stats.needs_review) || 0,
                            change: `${reviewsDueThisWeek || 0} due this week`,
                            positive: false,
                        },
                        stale_content: {
                            value: Number(stats.stale_documents) || 0,
                            change: staleChangeText,
                            positive: staleDelta <= 0,
                        },
                    },
                    health_distribution: {
                        excellent: {
                            count: excellentDocs,
                            percentage: totalDocs > 0 ? Math.round((excellentDocs / totalDocs) * 100) : 0,
                        },
                        good: {
                            count: goodDocs,
                            percentage: totalDocs > 0 ? Math.round((goodDocs / totalDocs) * 100) : 0,
                        },
                        needs_review: {
                            count: Number(stats.review_needed) || 0,
                            percentage: totalDocs > 0 ? Math.round((Number(stats.review_needed) / totalDocs) * 100) : 0,
                        },
                        poor: {
                            count: Number(stats.poor_health) || 0,
                            percentage: totalDocs > 0 ? Math.round((Number(stats.poor_health) / totalDocs) * 100) : 0,
                        },
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
            fastify.log.error({ error }, 'Unexpected error in GET /api/audit/stats');
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
     * GET /api/audit/stale-documents
     * Returns documents that haven't been updated recently
     */
    fastify.get('/api/audit/stale-documents', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const query = staleDocsQuerySchema.parse(request.query);
            const { days, limit } = query;
            const staleThreshold = new Date();
            staleThreshold.setDate(staleThreshold.getDate() - days);
            const { data: staleDocs, error } = await supabase_1.supabaseAdmin
                .from('documents')
                .select(`
            id,
            title,
            updated_at,
            view_count,
            status
          `)
                .eq('tenant_id', tenant.id)
                .not('content', 'like', '__CATEGORY__%')
                .lt('updated_at', staleThreshold.toISOString())
                .order('updated_at', { ascending: true })
                .limit(limit);
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch stale documents');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch stale documents',
                        details: {},
                    },
                });
            }
            // Calculate relative time and status severity
            const now = new Date();
            const formattedDocs = (staleDocs || []).map((doc) => {
                const updatedAt = new Date(doc.updated_at);
                const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
                let status = 'info';
                let lastUpdatedText = '';
                if (daysSinceUpdate >= 180) {
                    status = 'critical';
                    lastUpdatedText = `${Math.floor(daysSinceUpdate / 30)} months ago`;
                }
                else if (daysSinceUpdate >= 90) {
                    status = 'warning';
                    lastUpdatedText = `${Math.floor(daysSinceUpdate / 30)} months ago`;
                }
                else {
                    status = 'info';
                    lastUpdatedText = `${daysSinceUpdate} days ago`;
                }
                return {
                    id: doc.id,
                    title: doc.title,
                    last_updated: lastUpdatedText,
                    views: doc.view_count || 0,
                    status,
                };
            });
            fastify.log.info({ tenantId: tenant.id, userId: user.id, count: formattedDocs.length }, 'Stale documents fetched successfully');
            return reply.code(200).send({
                success: true,
                data: {
                    documents: formattedDocs,
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
            fastify.log.error({ error }, 'Unexpected error in GET /api/audit/stale-documents');
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
     * GET /api/audit/top-performers
     * Returns the most viewed documents
     */
    fastify.get('/api/audit/top-performers', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const query = topPerformersQuerySchema.parse(request.query);
            const { limit } = query;
            const { data: topDocs, error } = await supabase_1.supabaseAdmin
                .from('documents')
                .select(`
            id,
            title,
            view_count,
            status
          `)
                .eq('tenant_id', tenant.id)
                .eq('status', 'published')
                .not('content', 'like', '__CATEGORY__%')
                .order('view_count', { ascending: false })
                .limit(limit);
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch top performers');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch top performers',
                        details: {},
                    },
                });
            }
            // Format with view count context (no historical view tracking available yet)
            const maxViews = Math.max(...(topDocs || []).map((d) => d.view_count || 0), 1);
            const formattedDocs = (topDocs || []).map((doc) => {
                const views = doc.view_count || 0;
                const shareOfTop = Math.round((views / maxViews) * 100);
                return {
                    id: doc.id,
                    title: doc.title,
                    views,
                    trend: `${views.toLocaleString()} views`,
                    positive: shareOfTop >= 50,
                };
            });
            fastify.log.info({ tenantId: tenant.id, userId: user.id, count: formattedDocs.length }, 'Top performers fetched successfully');
            return reply.code(200).send({
                success: true,
                data: {
                    documents: formattedDocs,
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
            fastify.log.error({ error }, 'Unexpected error in GET /api/audit/top-performers');
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
     * GET /api/audit/reviews
     * Returns the review queue for scheduled document reviews
     */
    fastify.get('/api/audit/reviews', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const query = reviewQueueQuerySchema.parse(request.query);
            const { status, limit } = query;
            let dbQuery = supabase_1.supabaseAdmin
                .from('document_reviews')
                .select(`
            id,
            reason,
            priority,
            due_date,
            status,
            notes,
            created_at,
            documents (
              id,
              title
            )
          `)
                .eq('tenant_id', tenant.id)
                .order('due_date', { ascending: true })
                .limit(limit);
            if (status !== 'all') {
                dbQuery = dbQuery.eq('status', status);
            }
            const { data: reviews, error } = await dbQuery;
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch review queue');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch review queue',
                        details: {},
                    },
                });
            }
            // Format due dates as relative time
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const formattedReviews = (reviews || []).map((review) => {
                const dueDate = new Date(review.due_date);
                const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                let dueDateText = '';
                if (diffDays < 0) {
                    dueDateText = `${Math.abs(diffDays)} days overdue`;
                }
                else if (diffDays === 0) {
                    dueDateText = 'Today';
                }
                else if (diffDays === 1) {
                    dueDateText = 'Tomorrow';
                }
                else if (diffDays <= 7) {
                    dueDateText = `In ${diffDays} days`;
                }
                else {
                    dueDateText = dueDate.toLocaleDateString();
                }
                return {
                    id: review.id,
                    title: review.documents?.title || 'Unknown Document',
                    document_id: review.documents?.id,
                    reason: review.reason,
                    priority: review.priority,
                    due_date: dueDateText,
                    due_date_raw: review.due_date,
                    status: review.status,
                };
            });
            fastify.log.info({ tenantId: tenant.id, userId: user.id, count: formattedReviews.length }, 'Review queue fetched successfully');
            return reply.code(200).send({
                success: true,
                data: {
                    reviews: formattedReviews,
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
            fastify.log.error({ error }, 'Unexpected error in GET /api/audit/reviews');
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
     * POST /api/audit/reviews
     * Creates a new document review
     */
    fastify.post('/api/audit/reviews', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const body = createReviewBodySchema.parse(request.body);
            // Verify document exists and belongs to tenant
            const { data: doc, error: docError } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id, title')
                .eq('id', body.document_id)
                .eq('tenant_id', tenant.id)
                .single();
            if (docError || !doc) {
                return reply.code(404).send({
                    error: {
                        code: 'DOCUMENT_NOT_FOUND',
                        message: 'Document not found',
                        details: {},
                    },
                });
            }
            // Create review
            const { data: review, error: createError } = await supabase_1.supabaseAdmin
                .from('document_reviews')
                .insert({
                tenant_id: tenant.id,
                document_id: body.document_id,
                reason: body.reason,
                priority: body.priority,
                due_date: body.due_date,
                assigned_to: body.assigned_to || null,
                notes: body.notes || null,
                created_by: user.id,
            })
                .select()
                .single();
            if (createError) {
                fastify.log.error({ error: createError, tenantId: tenant.id }, 'Failed to create document review');
                return reply.code(500).send({
                    error: {
                        code: 'CREATE_FAILED',
                        message: 'Failed to create document review',
                        details: {},
                    },
                });
            }
            fastify.log.info({ tenantId: tenant.id, userId: user.id, reviewId: review.id, documentId: body.document_id }, 'Document review created successfully');
            return reply.code(201).send({
                success: true,
                data: {
                    review,
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request body',
                        details: error.errors,
                    },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in POST /api/audit/reviews');
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
     * PATCH /api/audit/reviews/:id
     * Updates a document review
     */
    fastify.patch('/api/audit/reviews/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid review ID format',
                        details: {},
                    },
                });
            }
            const body = updateReviewBodySchema.parse(request.body);
            // Build update object
            const updateData = {};
            if (body.status !== undefined) {
                updateData.status = body.status;
                if (body.status === 'completed') {
                    updateData.completed_at = new Date().toISOString();
                }
            }
            if (body.priority !== undefined)
                updateData.priority = body.priority;
            if (body.due_date !== undefined)
                updateData.due_date = body.due_date;
            if (body.assigned_to !== undefined)
                updateData.assigned_to = body.assigned_to;
            if (body.notes !== undefined)
                updateData.notes = body.notes;
            const { data: review, error: updateError } = await supabase_1.supabaseAdmin
                .from('document_reviews')
                .update(updateData)
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .select()
                .single();
            if (updateError) {
                if (updateError.code === 'PGRST116') {
                    return reply.code(404).send({
                        error: {
                            code: 'REVIEW_NOT_FOUND',
                            message: 'Review not found',
                            details: {},
                        },
                    });
                }
                fastify.log.error({ error: updateError, tenantId: tenant.id, reviewId: id }, 'Failed to update document review');
                return reply.code(500).send({
                    error: {
                        code: 'UPDATE_FAILED',
                        message: 'Failed to update document review',
                        details: {},
                    },
                });
            }
            fastify.log.info({ tenantId: tenant.id, userId: user.id, reviewId: id }, 'Document review updated successfully');
            return reply.code(200).send({
                success: true,
                data: {
                    review,
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request body',
                        details: error.errors,
                    },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in PATCH /api/audit/reviews/:id');
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
     * DELETE /api/audit/reviews/:id
     * Deletes a document review
     */
    fastify.delete('/api/audit/reviews/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid review ID format',
                        details: {},
                    },
                });
            }
            const { error: deleteError } = await supabase_1.supabaseAdmin
                .from('document_reviews')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenant.id);
            if (deleteError) {
                fastify.log.error({ error: deleteError, tenantId: tenant.id, reviewId: id }, 'Failed to delete document review');
                return reply.code(500).send({
                    error: {
                        code: 'DELETE_FAILED',
                        message: 'Failed to delete document review',
                        details: {},
                    },
                });
            }
            fastify.log.info({ tenantId: tenant.id, userId: user.id, reviewId: id }, 'Document review deleted successfully');
            return reply.code(200).send({
                success: true,
                data: {
                    message: 'Review deleted successfully',
                },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in DELETE /api/audit/reviews/:id');
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
     * POST /api/audit/run-full-audit
     * Performs a comprehensive content audit across all documents.
     * Identifies issues (stale, empty, uncategorised, low-view published docs)
     * and auto-creates review entries for documents that don't already have pending reviews.
     */
    fastify.post('/api/audit/run-full-audit', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const now = new Date();
            // 1. Fetch ALL documents for this tenant (excluding category markers)
            const { data: allDocs, error: docsError } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id, title, content, status, visibility, category_id, view_count, created_at, updated_at')
                .eq('tenant_id', tenant.id)
                .not('content', 'like', '__CATEGORY__%');
            if (docsError) {
                fastify.log.error({ error: docsError, tenantId: tenant.id }, 'Full audit: failed to fetch documents');
                return reply.code(500).send({ error: { code: 'FETCH_FAILED', message: 'Failed to fetch documents for audit', details: {} } });
            }
            const docs = allDocs || [];
            // 2. Fetch existing pending/in-progress reviews so we don't create duplicates
            const { data: existingReviews } = await supabase_1.supabaseAdmin
                .from('document_reviews')
                .select('document_id')
                .eq('tenant_id', tenant.id)
                .in('status', ['pending', 'in_progress']);
            const sixtyDaysAgo = new Date(now);
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            // Fetch completed reviews within the last 60 days
            const { data: recentCompletedReviews } = await supabase_1.supabaseAdmin
                .from('document_reviews')
                .select('document_id')
                .eq('tenant_id', tenant.id)
                .eq('status', 'completed')
                .gte('completed_at', sixtyDaysAgo.toISOString());
            const reviewedDocIds = new Set((existingReviews || []).map((r) => r.document_id));
            const recentlyReviewedIds = new Set((recentCompletedReviews || []).map((r) => r.document_id));
            const findings = [];
            const reviewsToCreate = [];
            let staleCount = 0;
            let emptyCount = 0;
            let uncategorisedCount = 0;
            let draftCount = 0;
            let lowViewCount = 0;
            let healthyCount = 0;
            const staleThreshold90 = new Date(now);
            staleThreshold90.setDate(staleThreshold90.getDate() - 90);
            const staleThreshold180 = new Date(now);
            staleThreshold180.setDate(staleThreshold180.getDate() - 180);
            const dueDate7 = new Date(now);
            dueDate7.setDate(dueDate7.getDate() + 7);
            const dueDate14 = new Date(now);
            dueDate14.setDate(dueDate14.getDate() + 14);
            for (const doc of docs) {
                // If the document was reviewed within the last 60 days, exclude it from further issues.
                if (recentlyReviewedIds.has(doc.id)) {
                    healthyCount++;
                    continue;
                }
                const issues = [];
                let severity = 'info';
                const updatedAt = new Date(doc.updated_at);
                const contentLength = (doc.content || '').trim().length;
                // Check: empty or very short content
                if (contentLength < 50) {
                    issues.push('Empty or minimal content');
                    severity = 'critical';
                    emptyCount++;
                }
                // Check: stale (not updated in 90+ days)
                if (updatedAt < staleThreshold90) {
                    const daysSince = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
                    if (updatedAt < staleThreshold180) {
                        issues.push(`Severely stale — not updated in ${daysSince} days`);
                        severity = 'critical';
                    }
                    else {
                        issues.push(`Stale — not updated in ${daysSince} days`);
                        if (severity !== 'critical')
                            severity = 'warning';
                    }
                    staleCount++;
                }
                // Check: no category
                if (!doc.category_id) {
                    issues.push('No category assigned');
                    if (severity === 'info')
                        severity = 'info';
                    uncategorisedCount++;
                }
                // Check: still in draft
                if (doc.status === 'draft') {
                    issues.push('Still in draft status');
                    if (severity !== 'critical')
                        severity = 'warning';
                    draftCount++;
                }
                // Check: published but very low views
                if (doc.status === 'published' && (doc.view_count || 0) === 0) {
                    issues.push('Published but has zero views');
                    if (severity === 'info')
                        severity = 'info';
                    lowViewCount++;
                }
                if (issues.length === 0) {
                    healthyCount++;
                    continue;
                }
                const needsReview = !reviewedDocIds.has(doc.id);
                findings.push({
                    document_id: doc.id,
                    title: doc.title,
                    issues,
                    severity,
                    auto_review_created: needsReview && (severity === 'critical' || severity === 'warning'),
                });
                // Auto-create reviews for critical/warning issues without existing reviews
                if (needsReview && (severity === 'critical' || severity === 'warning')) {
                    reviewsToCreate.push({
                        tenant_id: tenant.id,
                        document_id: doc.id,
                        reason: `Auto-audit: ${issues.join('; ')}`,
                        priority: severity === 'critical' ? 'high' : 'medium',
                        due_date: severity === 'critical'
                            ? dueDate7.toISOString().split('T')[0]
                            : dueDate14.toISOString().split('T')[0],
                        created_by: user.id,
                        notes: 'Created automatically by full content audit',
                    });
                }
            }
            // 4. Batch-insert reviews
            let reviewsCreated = 0;
            if (reviewsToCreate.length > 0) {
                const { data: created, error: insertError } = await supabase_1.supabaseAdmin
                    .from('document_reviews')
                    .insert(reviewsToCreate)
                    .select('id');
                if (insertError) {
                    fastify.log.error({ error: insertError, tenantId: tenant.id }, 'Full audit: failed to create reviews');
                }
                else {
                    reviewsCreated = (created || []).length;
                }
            }
            // 5. Build summary
            const summary = {
                total_documents: docs.length,
                healthy: healthyCount,
                issues_found: findings.length,
                reviews_created: reviewsCreated,
                breakdown: {
                    stale: staleCount,
                    empty_content: emptyCount,
                    uncategorised: uncategorisedCount,
                    stuck_in_draft: draftCount,
                    zero_views: lowViewCount,
                },
            };
            // Sort findings: critical first, then warning, then info
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
            fastify.log.info({ tenantId: tenant.id, userId: user.id, summary }, 'Full content audit completed');
            return reply.code(200).send({
                success: true,
                data: {
                    summary,
                    findings: findings.slice(0, 50), // Cap at 50 to avoid huge payloads
                    ran_at: now.toISOString(),
                },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in POST /api/audit/run-full-audit');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
            });
        }
    });
    /**
     * POST /api/audit/mark-reviewed/:id
     * Touches updated_at on a document to mark it as freshly reviewed
     * without changing any content. Creates a lineage event.
     */
    fastify.post('/api/audit/mark-reviewed/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid document ID format', details: {} },
                });
            }
            // Touch updated_at
            const { data: doc, error: updateError } = await supabase_1.supabaseAdmin
                .from('documents')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .select('id, title')
                .single();
            if (updateError) {
                if (updateError.code === 'PGRST116') {
                    return reply.code(404).send({
                        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found', details: {} },
                    });
                }
                fastify.log.error({ error: updateError, tenantId: tenant.id, docId: id }, 'Failed to mark document as reviewed');
                return reply.code(500).send({
                    error: { code: 'UPDATE_FAILED', message: 'Failed to mark document as reviewed', details: {} },
                });
            }
            // Create lineage event
            await supabase_1.supabaseAdmin
                .from('document_lineage')
                .insert({
                document_id: id,
                event_type: 'reviewed',
                actor_id: user.id,
                metadata: { action: 'mark_reviewed_via_audit' },
            });
            // Also complete any pending reviews for this document
            await supabase_1.supabaseAdmin
                .from('document_reviews')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('document_id', id)
                .eq('tenant_id', tenant.id)
                .in('status', ['pending', 'in_progress']);
            fastify.log.info({ tenantId: tenant.id, userId: user.id, docId: id }, 'Document marked as reviewed');
            return reply.code(200).send({
                success: true,
                data: { message: 'Document marked as reviewed', document: doc },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in POST /api/audit/mark-reviewed/:id');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
            });
        }
    });
    /**
     * POST /api/documents/:id/view
     * Increments the view count for a document
     */
    fastify.post('/api/documents/:id/view', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const { id } = request.params;
            if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid document ID format',
                        details: {},
                    },
                });
            }
            // Verify document exists and belongs to tenant
            const { data: doc, error: docError } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id')
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .single();
            if (docError || !doc) {
                return reply.code(404).send({
                    error: {
                        code: 'DOCUMENT_NOT_FOUND',
                        message: 'Document not found',
                        details: {},
                    },
                });
            }
            // Increment view count
            await supabase_1.supabaseAdmin.rpc('increment_document_view_count', { doc_id: id });
            return reply.code(200).send({
                success: true,
                data: {
                    message: 'View count incremented',
                },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in POST /api/documents/:id/view');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
}
//# sourceMappingURL=audit.js.map