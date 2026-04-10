"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = notificationRoutes;
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const notifications_1 = require("../services/notifications");
/**
 * Zod schema for GET /api/notifications query parameters
 */
const listNotificationsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    unread_only: zod_1.z.coerce.boolean().default(false),
});
/**
 * Zod schema for POST /api/notifications (create notification)
 */
const createNotificationBodySchema = zod_1.z.object({
    user_id: zod_1.z.string().uuid().optional(),
    type: zod_1.z.enum(['document', 'comment', 'mention', 'system', 'ai', 'billing', 'task', 'chat', 'credits', 'invoice', 'invitation']),
    title: zod_1.z.string().min(1).max(500),
    description: zod_1.z.string().max(2000).optional(),
    action_url: zod_1.z.string().max(1000).optional(),
    priority: zod_1.z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    category: zod_1.z.enum(['general', 'workspace', 'billing', 'security']).default('general'),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
/**
 * Zod schema for PUT /api/notifications/preferences
 */
const updatePreferencesBodySchema = zod_1.z.object({
    document_enabled: zod_1.z.boolean().optional(),
    comment_enabled: zod_1.z.boolean().optional(),
    mention_enabled: zod_1.z.boolean().optional(),
    system_enabled: zod_1.z.boolean().optional(),
    ai_enabled: zod_1.z.boolean().optional(),
    billing_enabled: zod_1.z.boolean().optional(),
    task_enabled: zod_1.z.boolean().optional(),
    chat_enabled: zod_1.z.boolean().optional(),
    credits_enabled: zod_1.z.boolean().optional(),
    invoice_enabled: zod_1.z.boolean().optional(),
    invitation_enabled: zod_1.z.boolean().optional(),
    in_app_enabled: zod_1.z.boolean().optional(),
    email_enabled: zod_1.z.boolean().optional(),
    quiet_hours_enabled: zod_1.z.boolean().optional(),
    quiet_hours_start: zod_1.z.string().optional(),
    quiet_hours_end: zod_1.z.string().optional(),
});
/**
 * Zod schema for path parameters
 */
const notificationIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
/**
 * Zod schema for PATCH /api/notifications/:id request body
 */
const markReadBodySchema = zod_1.z.object({
    read: zod_1.z.boolean(),
});
/**
 * Notifications routes
 */
async function notificationRoutes(fastify) {
    /**
     * GET /api/notifications
     * Lists all notifications for the authenticated user
     */
    fastify.get('/api/notifications', {
        preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware],
    }, async (request, reply) => {
        try {
            const user = request.user;
            const query = listNotificationsQuerySchema.parse(request.query);
            const { page, limit, unread_only } = query;
            const offset = (page - 1) * limit;
            // Build query
            let dbQuery = supabase_1.supabaseAdmin
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (unread_only) {
                dbQuery = dbQuery.eq('read', false);
            }
            // Execute query with pagination
            const { data: notifications, error, count } = await dbQuery.range(offset, offset + limit - 1);
            if (error) {
                request.log.error({ error, userId: user.id }, 'Failed to fetch notifications');
                return reply.status(500).send({
                    success: false,
                    error: {
                        message: 'Failed to fetch notifications',
                        code: 'FETCH_ERROR',
                    },
                });
            }
            // Get unread count
            const { count: unreadCount, error: unreadError } = await supabase_1.supabaseAdmin
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('read', false);
            if (unreadError) {
                request.log.error({ error: unreadError, userId: user.id }, 'Failed to fetch unread count');
            }
            return reply.send({
                success: true,
                data: {
                    notifications: notifications || [],
                    pagination: {
                        page,
                        limit,
                        total: count || 0,
                        totalPages: Math.ceil((count || 0) / limit),
                    },
                    unreadCount: unreadCount || 0,
                },
            });
        }
        catch (err) {
            const userId = request.user?.id;
            if (err instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        message: 'Invalid query parameters',
                        code: 'VALIDATION_ERROR',
                        details: err.errors,
                    },
                });
            }
            request.log.error({ error: err, userId }, 'Unexpected error in GET /api/notifications');
            return reply.status(500).send({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                },
            });
        }
    });
    /**
     * PATCH /api/notifications/:id
     * Marks a single notification as read/unread
     */
    fastify.patch('/api/notifications/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware],
    }, async (request, reply) => {
        try {
            const user = request.user;
            const { id } = notificationIdParamsSchema.parse(request.params);
            const body = markReadBodySchema.parse(request.body);
            // Update the notification
            const { data: notification, error } = await supabase_1.supabaseAdmin
                .from('notifications')
                .update({
                read: body.read,
                updated_at: new Date().toISOString(),
            })
                .eq('id', id)
                .eq('user_id', user.id)
                .select()
                .single();
            if (error) {
                request.log.error({ error, userId: user.id, notificationId: id }, 'Failed to mark notification as read');
                return reply.status(500).send({
                    success: false,
                    error: {
                        message: 'Failed to update notification',
                        code: 'UPDATE_ERROR',
                    },
                });
            }
            if (!notification) {
                return reply.status(404).send({
                    success: false,
                    error: {
                        message: 'Notification not found',
                        code: 'NOT_FOUND',
                    },
                });
            }
            return reply.send({
                success: true,
                data: notification,
            });
        }
        catch (err) {
            const userId = request.user?.id;
            if (err instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        message: 'Invalid request',
                        code: 'VALIDATION_ERROR',
                        details: err.errors,
                    },
                });
            }
            request.log.error({ error: err, userId }, 'Unexpected error in PATCH /api/notifications/:id');
            return reply.status(500).send({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                },
            });
        }
    });
    /**
     * POST /api/notifications/mark-all-read
     * Marks all notifications as read for the authenticated user
     */
    fastify.post('/api/notifications/mark-all-read', {
        preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware],
    }, async (request, reply) => {
        try {
            const user = request.user;
            // Update all unread notifications
            const { error } = await supabase_1.supabaseAdmin
                .from('notifications')
                .update({
                read: true,
                updated_at: new Date().toISOString(),
            })
                .eq('user_id', user.id)
                .eq('read', false);
            if (error) {
                request.log.error({ error, userId: user.id }, 'Failed to mark all notifications as read');
                return reply.status(500).send({
                    success: false,
                    error: {
                        message: 'Failed to mark all notifications as read',
                        code: 'UPDATE_ERROR',
                    },
                });
            }
            return reply.send({
                success: true,
                data: {
                    message: 'All notifications marked as read',
                },
            });
        }
        catch (err) {
            const userId = request.user?.id;
            request.log.error({ error: err, userId }, 'Unexpected error in POST /api/notifications/mark-all-read');
            return reply.status(500).send({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                },
            });
        }
    });
    /**
     * DELETE /api/notifications/:id
     * Deletes a single notification
     */
    fastify.delete('/api/notifications/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware],
    }, async (request, reply) => {
        try {
            const user = request.user;
            const { id } = notificationIdParamsSchema.parse(request.params);
            // Delete the notification
            const { error } = await supabase_1.supabaseAdmin
                .from('notifications')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);
            if (error) {
                request.log.error({ error, userId: user.id, notificationId: id }, 'Failed to delete notification');
                return reply.status(500).send({
                    success: false,
                    error: {
                        message: 'Failed to delete notification',
                        code: 'DELETE_ERROR',
                    },
                });
            }
            return reply.send({
                success: true,
                data: {
                    message: 'Notification deleted',
                },
            });
        }
        catch (err) {
            const userId = request.user?.id;
            if (err instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        message: 'Invalid request',
                        code: 'VALIDATION_ERROR',
                        details: err.errors,
                    },
                });
            }
            request.log.error({ error: err, userId }, 'Unexpected error in DELETE /api/notifications/:id');
            return reply.status(500).send({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                },
            });
        }
    });
    /**
     * DELETE /api/notifications
     * Clears all notifications for the authenticated user
     */
    fastify.delete('/api/notifications', {
        preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware],
    }, async (request, reply) => {
        try {
            const user = request.user;
            // Delete all notifications for the user
            const { error } = await supabase_1.supabaseAdmin
                .from('notifications')
                .delete()
                .eq('user_id', user.id);
            if (error) {
                request.log.error({ error, userId: user.id }, 'Failed to clear all notifications');
                return reply.status(500).send({
                    success: false,
                    error: {
                        message: 'Failed to clear all notifications',
                        code: 'DELETE_ERROR',
                    },
                });
            }
            return reply.send({
                success: true,
                data: {
                    message: 'All notifications cleared',
                },
            });
        }
        catch (err) {
            const userId = request.user?.id;
            request.log.error({ error: err, userId }, 'Unexpected error in DELETE /api/notifications');
            return reply.status(500).send({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                },
            });
        }
    });
    /**
     * POST /api/notifications
     * Creates a new notification (admin/system use or self-notification)
     */
    fastify.post('/api/notifications', {
        preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware],
    }, async (request, reply) => {
        try {
            const user = request.user;
            const body = createNotificationBodySchema.parse(request.body);
            // Only admins/super_admins can create notifications for other users
            const targetUserId = body.user_id || user.id;
            if (body.user_id && body.user_id !== user.id && !user.is_super_admin && user.role !== 'admin') {
                return reply.status(403).send({
                    success: false,
                    error: {
                        message: 'Only admins can create notifications for other users',
                        code: 'FORBIDDEN',
                    },
                });
            }
            const result = await (0, notifications_1.createNotification)({
                userId: targetUserId,
                tenantId: user.tenant_id,
                type: body.type,
                title: body.title,
                description: body.description,
                actionUrl: body.action_url,
                priority: body.priority,
                category: body.category,
                metadata: body.metadata,
            });
            if (!result) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        message: 'Failed to create notification (may be disabled by user preferences)',
                        code: 'CREATE_FAILED',
                    },
                });
            }
            return reply.status(201).send({
                success: true,
                data: { id: result.id, message: 'Notification created' },
            });
        }
        catch (err) {
            const userId = request.user?.id;
            if (err instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        message: 'Invalid request body',
                        code: 'VALIDATION_ERROR',
                        details: err.errors,
                    },
                });
            }
            request.log.error({ error: err, userId }, 'Unexpected error in POST /api/notifications');
            return reply.status(500).send({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                },
            });
        }
    });
    /**
     * GET /api/notifications/preferences
     * Fetches the notification preferences for the authenticated user
     */
    fastify.get('/api/notifications/preferences', {
        preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware],
    }, async (request, reply) => {
        try {
            const user = request.user;
            const { data: prefs, error } = await supabase_1.supabaseAdmin
                .from('notification_preferences')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();
            if (error) {
                request.log.error({ error, userId: user.id }, 'Failed to fetch notification preferences');
                return reply.status(500).send({
                    success: false,
                    error: {
                        message: 'Failed to fetch preferences',
                        code: 'FETCH_ERROR',
                    },
                });
            }
            // Return defaults if no preferences row exists yet
            const defaults = {
                document_enabled: true,
                comment_enabled: true,
                mention_enabled: true,
                system_enabled: true,
                ai_enabled: true,
                billing_enabled: true,
                task_enabled: true,
                chat_enabled: true,
                credits_enabled: true,
                invoice_enabled: true,
                invitation_enabled: true,
                in_app_enabled: true,
                email_enabled: false,
                quiet_hours_enabled: false,
                quiet_hours_start: null,
                quiet_hours_end: null,
            };
            return reply.send({
                success: true,
                data: prefs || defaults,
            });
        }
        catch (err) {
            const userId = request.user?.id;
            request.log.error({ error: err, userId }, 'Unexpected error in GET /api/notifications/preferences');
            return reply.status(500).send({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                },
            });
        }
    });
    /**
     * PUT /api/notifications/preferences
     * Updates notification preferences for the authenticated user (upsert)
     */
    fastify.put('/api/notifications/preferences', {
        preHandler: [rateLimit_1.rateLimitMiddleware, auth_1.authMiddleware],
    }, async (request, reply) => {
        try {
            const user = request.user;
            const body = updatePreferencesBodySchema.parse(request.body);
            const { data: prefs, error } = await supabase_1.supabaseAdmin
                .from('notification_preferences')
                .upsert({
                user_id: user.id,
                tenant_id: user.tenant_id,
                ...body,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
                .select()
                .single();
            if (error) {
                request.log.error({ error, userId: user.id }, 'Failed to update notification preferences');
                return reply.status(500).send({
                    success: false,
                    error: {
                        message: 'Failed to update preferences',
                        code: 'UPDATE_ERROR',
                    },
                });
            }
            return reply.send({
                success: true,
                data: prefs,
            });
        }
        catch (err) {
            const userId = request.user?.id;
            if (err instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        message: 'Invalid request body',
                        code: 'VALIDATION_ERROR',
                        details: err.errors,
                    },
                });
            }
            request.log.error({ error: err, userId }, 'Unexpected error in PUT /api/notifications/preferences');
            return reply.status(500).send({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                },
            });
        }
    });
}
//# sourceMappingURL=notifications.js.map