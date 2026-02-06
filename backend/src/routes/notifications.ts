import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

/**
 * Zod schema for GET /api/notifications query parameters
 */
const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unread_only: z.coerce.boolean().default(false),
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
}
