"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = dashboardRoutes;
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../lib/supabase");
// Tier credit allocations (must match auth.ts and creditGuard.ts)
const TIER_CREDITS = {
    free: 10,
    base: 100,
    pro: 500,
    enterprise: 1000,
};
/**
 * Dashboard stats endpoint
 * GET /api/dashboard/stats
 */
async function dashboardRoutes(fastify) {
    fastify.get('/api/dashboard/stats', {
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
            // Get document count
            const { count: documentCount, error: docCountError } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id);
            if (docCountError) {
                request.log.error({ error: docCountError }, 'Failed to count documents');
            }
            // Get published document count
            const { count: publishedCount, error: publishedError } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('status', 'published');
            if (publishedError) {
                request.log.error({ error: publishedError }, 'Failed to count published documents');
            }
            // Get team member count
            const { count: teamCount, error: teamError } = await supabase_1.supabaseAdmin
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('status', 'active');
            if (teamError) {
                request.log.error({ error: teamError }, 'Failed to count team members');
            }
            // Get AI generation count for current month (all AI-related query types)
            const currentMonth = new Date().toISOString().slice(0, 7);
            const { count: aiGenerationCount, error: aiError } = await supabase_1.supabaseAdmin
                .from('query_usage')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('month_year', currentMonth);
            if (aiError) {
                request.log.error({ error: aiError }, 'Failed to count AI generations');
            }
            // Get credit usage for current month
            let { data: creditPool, error: creditError } = await supabase_1.supabaseAdmin
                .from('credit_pools')
                .select('total_credits, used_credits')
                .eq('tenant_id', tenant.id)
                .eq('month_year', currentMonth)
                .single();
            // If credit pool doesn't exist for this month, create it
            if (creditError && creditError.code === 'PGRST116') {
                const tierCredits = TIER_CREDITS[tenant.tier] || TIER_CREDITS.free;
                const { data: newPool, error: createError } = await supabase_1.supabaseAdmin
                    .from('credit_pools')
                    .insert({
                    tenant_id: tenant.id,
                    month_year: currentMonth,
                    total_credits: tierCredits,
                    used_credits: 0,
                })
                    .select('total_credits, used_credits')
                    .single();
                if (createError) {
                    request.log.error({ error: createError }, 'Failed to create credit pool');
                }
                else {
                    creditPool = newPool;
                    creditError = null;
                }
            }
            else if (creditError) {
                request.log.error({ error: creditError }, 'Failed to fetch credit pool');
            }
            // Get storage usage
            const { data: storageData, error: storageError } = await supabase_1.supabaseAdmin
                .rpc('get_tenant_storage_usage', { tenant_id_param: tenant.id });
            if (storageError) {
                request.log.error({ error: storageError }, 'Failed to get storage usage');
            }
            // Debug: Log storage data
            request.log.info({ storageData, storageError, tenantId: tenant.id }, 'Storage usage result');
            // Get content health stats using the same function as audit dashboard
            const { data: healthStats, error: healthError } = await supabase_1.supabaseAdmin
                .rpc('get_content_health_stats', {
                tenant_id_param: tenant.id,
                days_threshold: 30,
            });
            if (healthError) {
                request.log.error({ error: healthError }, 'Failed to get content health stats');
            }
            const totalCredits = creditPool?.total_credits || 0;
            const usedCredits = creditPool?.used_credits || 0;
            const remainingCredits = totalCredits - usedCredits;
            const storageRow = Array.isArray(storageData) ? storageData[0] : storageData;
            const storageUsedBytes = storageRow?.total_bytes || 0;
            // Calculate storage - use MB for display when under 1GB
            const storageLimitBytes = tenant.storage_limit || 5 * 1024 * 1024 * 1024; // Default 5GB
            const storageUsedMB = storageUsedBytes / (1024 * 1024);
            const storageUsedGB = storageUsedBytes / (1024 * 1024 * 1024);
            const storageLimitMB = storageLimitBytes / (1024 * 1024);
            const storageLimitGB = storageLimitBytes / (1024 * 1024 * 1024);
            // Calculate content health percentage using the same logic as audit dashboard
            const healthStatsRow = Array.isArray(healthStats) ? healthStats[0] : healthStats;
            const totalDocs = Number(healthStatsRow?.total_documents) || 0;
            const excellentDocs = Number(healthStatsRow?.excellent_health) || 0;
            const goodDocs = Number(healthStatsRow?.good_health) || 0;
            const contentHealthPercentage = totalDocs > 0
                ? Math.round(((excellentDocs + goodDocs) / totalDocs) * 100)
                : 0;
            return reply.status(200).send({
                success: true,
                data: {
                    documents: {
                        total: documentCount || 0,
                        published: publishedCount || 0,
                        draft: (documentCount || 0) - (publishedCount || 0),
                    },
                    team: {
                        members: teamCount || 0,
                    },
                    ai: {
                        generations: aiGenerationCount || 0,
                        credits_remaining: remainingCredits,
                        credits_total: totalCredits,
                    },
                    storage: {
                        used_bytes: storageUsedBytes,
                        used_mb: parseFloat(storageUsedMB.toFixed(2)),
                        used_gb: parseFloat(storageUsedGB.toFixed(4)),
                        limit_mb: parseFloat(storageLimitMB.toFixed(0)),
                        limit_gb: parseFloat(storageLimitGB.toFixed(2)),
                        percentage: storageLimitGB > 0 ? parseFloat(((storageUsedGB / storageLimitGB) * 100).toFixed(1)) : 0,
                    },
                    content_health: {
                        percentage: contentHealthPercentage,
                    },
                },
            });
        }
        catch (error) {
            request.log.error({
                tenantId: tenant.id,
                userId: user?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Error in dashboard stats endpoint');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while fetching dashboard stats',
                },
            });
        }
    });
    // Recent documents endpoint
    fastify.get('/api/dashboard/recent-documents', {
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
            const { data: documents, error: docsError } = await supabase_1.supabaseAdmin
                .from('documents')
                .select('id, title, status, created_at, updated_at, author_id')
                .eq('tenant_id', tenant.id)
                .order('updated_at', { ascending: false })
                .limit(5);
            if (docsError) {
                request.log.error({ error: docsError }, 'Failed to fetch recent documents');
                throw docsError;
            }
            return reply.status(200).send({
                success: true,
                data: {
                    documents: documents || [],
                },
            });
        }
        catch (error) {
            request.log.error({
                tenantId: tenant.id,
                userId: user?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Error in recent documents endpoint');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while fetching recent documents',
                },
            });
        }
    });
    // Recent activity endpoint
    fastify.get('/api/dashboard/recent-activity', {
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
            // Get recent document lineage events
            const { data: activities, error: activityError } = await supabase_1.supabaseAdmin
                .from('document_lineage')
                .select(`
            id,
            event_type,
            created_at,
            actor_id,
            document_id,
            documents!inner(title)
          `)
                .eq('documents.tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(10);
            if (activityError) {
                request.log.error({ error: activityError }, 'Failed to fetch recent activity');
                throw activityError;
            }
            // Fetch user information for all actors in the tenant
            const actorIds = [...new Set(activities?.map(a => a.actor_id) || [])];
            const { data: users } = await supabase_1.supabaseAdmin
                .from('users')
                .select('id, full_name, email')
                .eq('tenant_id', tenant.id)
                .in('id', actorIds);
            // Create a map of user id to user data
            const userMap = new Map(users?.map(u => [u.id, { full_name: u.full_name, email: u.email }]) || []);
            // Merge user information into activities
            const activitiesWithUsers = activities?.map(activity => ({
                ...activity,
                users: userMap.get(activity.actor_id) || null
            })) || [];
            return reply.status(200).send({
                success: true,
                data: {
                    activities: activitiesWithUsers,
                },
            });
        }
        catch (error) {
            request.log.error({
                tenantId: tenant.id,
                userId: user?.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Error in recent activity endpoint');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An error occurred while fetching recent activity',
                },
            });
        }
    });
}
//# sourceMappingURL=dashboard.js.map