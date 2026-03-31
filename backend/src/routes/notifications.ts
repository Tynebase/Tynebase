import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { createNotification, type NotificationType, type NotificationPriority, type NotificationCategory } from '../services/notifications';

/**
 * Zod schema for GET /api/notifications query parameters
 */
const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unread_only: z.coerce.boolean().default(false),
});

/**
 * Zod schema for POST /api/notifications (create notification)
 */
const createNotificationBodySchema = z.object({
  user_id: z.string().uuid().optional(),
  type: z.enum(['document', 'comment', 'mention', 'system', 'ai', 'billing', 'task', 'chat', 'credits', 'invoice', 'invitation']),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  action_url: z.string().max(1000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.enum(['general', 'workspace', 'billing', 'security']).default('general'),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for PUT /api/notifications/preferences
 */
const updatePreferencesBodySchema = z.object({
  document_enabled: z.boolean().optional(),
  comment_enabled: z.boolean().optional(),
  mention_enabled: z.boolean().optional(),
  system_enabled: z.boolean().optional(),
  ai_enabled: z.boolean().optional(),
  billing_enabled: z.boolean().optional(),
  task_enabled: z.boolean().optional(),
  chat_enabled: z.boolean().optional(),
  credits_enabled: z.boolean().optional(),
  invoice_enabled: z.boolean().optional(),
  invitation_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
});

/**
 * Zod schema for path parameters
 */
const notificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for PATCH /api/notifications/:id request body
 */
const markReadBodySchema = z.object({
  read: z.boolean(),
});

/**
 * Notifications routes
 */
export default async function notificationRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/notifications
   * Lists all notifications for the authenticated user
   */
  fastify.get(
    '/api/notifications',
    {
      preHandler: [rateLimitMiddleware, authMiddleware],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const query = listNotificationsQuerySchema.parse(request.query);
        const { page, limit, unread_only } = query;
        const offset = (page - 1) * limit;

        // Build query
        let dbQuery = supabaseAdmin
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
        const { count: unreadCount, error: unreadError } = await supabaseAdmin
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
      } catch (err) {
        const userId = (request as any).user?.id;
        if (err instanceof z.ZodError) {
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
    }
  );

  /**
   * PATCH /api/notifications/:id
   * Marks a single notification as read/unread
   */
  fastify.patch(
    '/api/notifications/:id',
    {
      preHandler: [rateLimitMiddleware, authMiddleware],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = notificationIdParamsSchema.parse(request.params);
        const body = markReadBodySchema.parse(request.body);

        // Update the notification
        const { data: notification, error } = await supabaseAdmin
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
      } catch (err) {
        const userId = (request as any).user?.id;
        if (err instanceof z.ZodError) {
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
    }
  );

  /**
   * POST /api/notifications/mark-all-read
   * Marks all notifications as read for the authenticated user
   */
  fastify.post(
    '/api/notifications/mark-all-read',
    {
      preHandler: [rateLimitMiddleware, authMiddleware],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;

        // Update all unread notifications
        const { error } = await supabaseAdmin
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
      } catch (err) {
        const userId = (request as any).user?.id;
        request.log.error({ error: err, userId }, 'Unexpected error in POST /api/notifications/mark-all-read');
        return reply.status(500).send({
          success: false,
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
          },
        });
      }
    }
  );

  /**
   * DELETE /api/notifications/:id
   * Deletes a single notification
   */
  fastify.delete(
    '/api/notifications/:id',
    {
      preHandler: [rateLimitMiddleware, authMiddleware],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = notificationIdParamsSchema.parse(request.params);

        // Delete the notification
        const { error } = await supabaseAdmin
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
      } catch (err) {
        const userId = (request as any).user?.id;
        if (err instanceof z.ZodError) {
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
    }
  );

  /**
   * DELETE /api/notifications
   * Clears all notifications for the authenticated user
   */
  fastify.delete(
    '/api/notifications',
    {
      preHandler: [rateLimitMiddleware, authMiddleware],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;

        // Delete all notifications for the user
        const { error } = await supabaseAdmin
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
      } catch (err) {
        const userId = (request as any).user?.id;
        request.log.error({ error: err, userId }, 'Unexpected error in DELETE /api/notifications');
        return reply.status(500).send({
          success: false,
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
          },
        });
      }
    }
  );

  /**
   * POST /api/notifications
   * Creates a new notification (admin/system use or self-notification)
   */
  fastify.post(
    '/api/notifications',
    {
      preHandler: [rateLimitMiddleware, authMiddleware],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
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

        const result = await createNotification({
          userId: targetUserId,
          tenantId: user.tenant_id,
          type: body.type as NotificationType,
          title: body.title,
          description: body.description,
          actionUrl: body.action_url,
          priority: body.priority as NotificationPriority,
          category: body.category as NotificationCategory,
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
      } catch (err) {
        const userId = (request as any).user?.id;
        if (err instanceof z.ZodError) {
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
    }
  );

  /**
   * GET /api/notifications/preferences
   * Fetches the notification preferences for the authenticated user
   */
  fastify.get(
    '/api/notifications/preferences',
    {
      preHandler: [rateLimitMiddleware, authMiddleware],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;

        const { data: prefs, error } = await supabaseAdmin
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
      } catch (err) {
        const userId = (request as any).user?.id;
        request.log.error({ error: err, userId }, 'Unexpected error in GET /api/notifications/preferences');
        return reply.status(500).send({
          success: false,
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
          },
        });
      }
    }
  );

  /**
   * PUT /api/notifications/preferences
   * Updates notification preferences for the authenticated user (upsert)
   */
  fastify.put(
    '/api/notifications/preferences',
    {
      preHandler: [rateLimitMiddleware, authMiddleware],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const body = updatePreferencesBodySchema.parse(request.body);

        const { data: prefs, error } = await supabaseAdmin
          .from('notification_preferences')
          .upsert(
            {
              user_id: user.id,
              tenant_id: user.tenant_id,
              ...body,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
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
      } catch (err) {
        const userId = (request as any).user?.id;
        if (err instanceof z.ZodError) {
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
    }
  );
}
