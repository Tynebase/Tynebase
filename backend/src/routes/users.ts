import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { sendRoleChangeEmail, sendUserRemovedEmail } from '../services/email';

/**
 * Zod schema for GET /api/users query parameters
 */
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  role: z.enum(['admin', 'editor', 'member', 'viewer']).optional(),
});

/**
 * Zod schema for PATCH /api/users/:id body parameters
 */
const updateUserBodySchema = z.object({
  role: z.enum(['admin', 'editor', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  full_name: z.string().min(1).max(100).optional(),
});

/**
 * Users management routes
 */
export default async function usersRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/users
   * Lists users in the tenant with pagination
   * 
   * Query Parameters:
   * - page (optional): Page number (default: 1)
   * - limit (optional): Items per page, max 100 (default: 50)
   * - status (optional): Filter by status (active, pending, suspended)
   * - role (optional): Filter by role (admin, editor, member, viewer)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be member of tenant
   * 
   * Response includes:
   * - users: Array of user objects
   * - pagination: Page info with total count
   */
  fastify.get(
    '/api/users',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Validate query parameters
        const query = listUsersQuerySchema.parse(request.query);
        const { page, limit, status, role } = query;

        // Calculate pagination offset
        const offset = (page - 1) * limit;

        // Build query for users in tenant
        let usersQuery = supabaseAdmin
          .from('users')
          .select('id, email, full_name, role, status, created_at, last_active_at', { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        // Apply filters - default to excluding deleted users
        if (status) {
          usersQuery = usersQuery.eq('status', status);
        } else {
          // By default, don't show deleted users
          usersQuery = usersQuery.neq('status', 'deleted');
        }
        if (role) {
          usersQuery = usersQuery.eq('role', role);
        }

        // Apply pagination
        usersQuery = usersQuery.range(offset, offset + limit - 1);

        const { data: users, count, error } = await usersQuery;

        if (error) {
          fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch users');
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch users',
              details: {},
            },
          });
        }

        // Get document counts for each user
        const userIds = users?.map(u => u.id) || [];
        let documentCounts: Record<string, number> = {};

        if (userIds.length > 0) {
          const { data: docCounts, error: docError } = await supabaseAdmin
            .from('documents')
            .select('author_id')
            .eq('tenant_id', tenant.id)
            .in('author_id', userIds);

          if (!docError && docCounts) {
            documentCounts = docCounts.reduce((acc: Record<string, number>, doc) => {
              acc[doc.author_id] = (acc[doc.author_id] || 0) + 1;
              return acc;
            }, {});
          }
        }

        // Enrich users with document counts
        const enrichedUsers = users?.map(u => ({
          ...u,
          documents_count: documentCounts[u.id] || 0,
        })) || [];

        const total = count || 0;
        const totalPages = Math.ceil(total / limit);

        fastify.log.info(
          { tenantId: tenant.id, userId: user.id, userCount: enrichedUsers.length },
          'Users fetched successfully'
        );

        return reply.code(200).send({
          success: true,
          data: {
            users: enrichedUsers,
            pagination: {
              page,
              limit,
              total,
              totalPages,
              hasNextPage: page < totalPages,
              hasPrevPage: page > 1,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in GET /api/users');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
          },
        });
      }
    }
  );

  /**
   * PATCH /api/users/:id
   * Updates a user's role or status
   */
  fastify.patch(
    '/api/users/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const currentUser = (request as any).user;
        const { id } = request.params as { id: string };

        if (currentUser.role !== 'admin' && !currentUser.is_super_admin) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Only admins can update users' },
          });
        }

        const body = updateUserBodySchema.parse(request.body);

        const { data: targetUser, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, role')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !targetUser) {
          return reply.code(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        if (id === currentUser.id && body.role && body.role !== 'admin') {
          return reply.code(400).send({
            error: { code: 'CANNOT_DEMOTE_SELF', message: 'Cannot demote yourself' },
          });
        }

        const updateData: Record<string, string> = {};
        if (body.role) updateData.role = body.role;
        if (body.status) updateData.status = body.status;
        if (body.full_name) updateData.full_name = body.full_name;

        if (Object.keys(updateData).length === 0) {
          return reply.code(400).send({
            error: { code: 'NO_CHANGES', message: 'No valid fields to update' },
          });
        }

        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .select('id, email, full_name, role, status, created_at, last_active_at')
          .single();

        if (updateError) {
          return reply.code(500).send({
            error: { code: 'UPDATE_FAILED', message: 'Failed to update user' },
          });
        }

        // Send email notification if role was changed
        if (body.role && body.role !== targetUser.role) {
          sendRoleChangeEmail({
            to: updatedUser.email,
            userName: updatedUser.full_name || updatedUser.email.split('@')[0],
            tenantName: tenant.name,
            oldRole: targetUser.role,
            newRole: body.role,
            changedBy: currentUser.full_name || currentUser.email,
          }).catch(err => {
            fastify.log.error({ error: err, userId: id }, 'Failed to send role change email');
          });
        }

        return reply.code(200).send({ success: true, data: { user: updatedUser } });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.errors },
          });
        }
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
        });
      }
    }
  );

  /**
   * DELETE /api/users/:id
   * Removes a user from the tenant
   */
  fastify.delete(
    '/api/users/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const currentUser = (request as any).user;
        const { id } = request.params as { id: string };

        if (currentUser.role !== 'admin' && !currentUser.is_super_admin) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Only admins can remove users' },
          });
        }

        if (id === currentUser.id) {
          return reply.code(400).send({
            error: { code: 'CANNOT_DELETE_SELF', message: 'Cannot delete yourself' },
          });
        }

        const { data: targetUser, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !targetUser) {
          return reply.code(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .update({ status: 'deleted' })
          .eq('id', id)
          .eq('tenant_id', tenant.id);

        if (deleteError) {
          return reply.code(500).send({
            error: { code: 'DELETE_FAILED', message: 'Failed to remove user' },
          });
        }

        // Send email notification to removed user
        sendUserRemovedEmail({
          to: targetUser.email,
          userName: targetUser.full_name || targetUser.email.split('@')[0],
          tenantName: tenant.name,
          removedBy: currentUser.full_name || currentUser.email,
        }).catch(err => {
          fastify.log.error({ error: err, userId: id }, 'Failed to send user removed email');
        });

        return reply.code(200).send({ success: true, data: { message: 'User removed' } });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
        });
      }
    }
  );

  /**
   * DELETE /api/users/:id/leave
   * Allows a user to leave a workspace (remove themselves)
   * Only works if the user is removing themselves and is not an admin
   */
  fastify.delete(
    '/api/users/:id/leave',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const tenant = (request as any).tenant;
        const currentUser = (request as any).user;

        // User can only remove themselves
        if (id !== currentUser.id) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'You can only remove yourself from a workspace' },
          });
        }

        // Admins cannot leave - they own the workspace
        if (currentUser.role === 'admin' || currentUser.is_super_admin) {
          return reply.code(400).send({
            error: { code: 'ADMIN_CANNOT_LEAVE', message: 'Admins cannot leave the workspace. Transfer ownership first or delete the workspace.' },
          });
        }

        // Soft delete the user (set status to deleted)
        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .update({ status: 'deleted' })
          .eq('id', id)
          .eq('tenant_id', tenant.id);

        if (deleteError) {
          fastify.log.error({ error: deleteError, userId: id }, 'Failed to leave workspace');
          return reply.code(500).send({
            error: { code: 'LEAVE_FAILED', message: 'Failed to leave workspace' },
          });
        }

        fastify.log.info({ userId: id, tenantId: tenant.id }, 'User left workspace');

        return reply.code(200).send({ success: true, data: { message: 'Successfully left workspace' } });
      } catch (error) {
        fastify.log.error({ error }, 'Error in leave workspace endpoint');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
        });
      }
    }
  );
}
