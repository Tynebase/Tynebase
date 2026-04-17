import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { superAdminGuard } from '../middleware/superAdminGuard';
import { supabaseAdmin } from '../lib/supabase';
import { z } from 'zod';

/**
 * Query Parameters Schema for listing all users
 */
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
  status: z.enum(['active', 'suspended', 'all']).default('all'),
  filter: z.enum(['new30d', 'active7d']).optional(),
});

/**
 * User ID Parameter Schema
 */
const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Assign Credits Body Schema
 */
const assignCreditsBodySchema = z.object({
  credits: z.number().int().min(1).max(100000),
});

/**
 * Super Admin User Management Routes
 * 
 * Provides platform-wide user management capabilities:
 * - List all users across all tenants
 * - Delete users
 * - Send password recovery emails
 * - Assign AI credits to tenant credit pools
 */
export default async function superAdminUsersRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/superadmin/users
   * 
   * Returns paginated list of all users across all tenants
   */
  fastify.get(
    '/api/superadmin/users',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const query = listUsersQuerySchema.parse(request.query);
        const { page, limit, search, status, filter } = query;
        const offset = (page - 1) * limit;

        // Calculate date ranges for filters
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let dbQuery = supabaseAdmin
          .from('users')
          .select(`
            id,
            email,
            full_name,
            role,
            status,
            tenant_id,
            is_super_admin,
            created_at,
            last_active_at
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        // Apply time-based filters
        if (filter === 'new30d') {
          dbQuery = dbQuery.gte('created_at', thirtyDaysAgo.toISOString());
        } else if (filter === 'active7d') {
          dbQuery = dbQuery.gte('last_active_at', sevenDaysAgo.toISOString());
        }

        if (status !== 'all') {
          dbQuery = dbQuery.eq('status', status);
        }

        if (search && search.trim()) {
          const searchTerm = `%${search.trim()}%`;
          dbQuery = dbQuery.or(`email.ilike.${searchTerm},full_name.ilike.${searchTerm}`);
        }

        const { data: users, error, count } = await dbQuery;

        if (error) {
          request.log.error({ error }, 'Failed to fetch users');
          throw error;
        }

        // Get tenant info for all users
        const tenantIds = [...new Set((users || []).map(u => u.tenant_id).filter(Boolean))];
        let tenantMap = new Map<string, { name: string; subdomain: string }>();

        if (tenantIds.length > 0) {
          const { data: tenants } = await supabaseAdmin
            .from('tenants')
            .select('id, name, subdomain')
            .in('id', tenantIds);

          tenants?.forEach(t => {
            tenantMap.set(t.id, { name: t.name, subdomain: t.subdomain });
          });
        }

        const enrichedUsers = (users || []).map(u => ({
          ...u,
          tenant_name: tenantMap.get(u.tenant_id)?.name || 'N/A',
          tenant_subdomain: tenantMap.get(u.tenant_id)?.subdomain || 'N/A',
        }));

        return {
          success: true,
          data: {
            users: enrichedUsers,
            pagination: {
              page,
              limit,
              total: count || 0,
              totalPages: Math.ceil((count || 0) / limit),
            },
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: { code: 'INVALID_QUERY_PARAMS', message: 'Invalid query parameters', details: error.errors },
          });
        }
        request.log.error({ error }, 'Error retrieving users list');
        return reply.status(500).send({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve users' },
        });
      }
    }
  );

  /**
   * DELETE /api/superadmin/users/:userId
   * 
   * Soft-deletes a user by setting status to 'archived'
   */
  fastify.delete(
    '/api/superadmin/users/:userId',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const { userId } = userIdParamsSchema.parse(request.params);

        // Verify user exists (handle multiple rows per ID)
        const { data: users, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, is_super_admin, status')
          .eq('id', userId)
          .order('tenant_id', { ascending: true })
          .limit(1);

        const targetUser = users?.[0];

        if (fetchError || !targetUser) {
          return reply.status(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        // Prevent deleting super admins
        if (targetUser.is_super_admin) {
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Cannot delete a super admin user' },
          });
        }

        if (targetUser.status === 'suspended') {
          return reply.status(400).send({
            error: { code: 'ALREADY_ARCHIVED', message: 'User is already archived' },
          });
        }

        // Soft delete
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ status: 'suspended' })
          .eq('id', userId);

        if (updateError) {
          request.log.error({ error: updateError }, 'Failed to delete user');
          throw updateError;
        }

        request.log.info(
          { superAdminId: request.user?.id, archivedUserId: userId, archivedEmail: targetUser.email },
          'Super admin archived user'
        );

        return {
          success: true,
          message: `User ${targetUser.email} has been archived`,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: { code: 'INVALID_PARAMS', message: 'Invalid parameters' },
          });
        }
        request.log.error({ error }, 'Error archiving user');
        return reply.status(500).send({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to archive user' },
        });
      }
    }
  );

  /**
   * POST /api/superadmin/users/:userId/restore
   *
   * Re-instates a soft-deleted user, setting their status back to 'active'
   */
  fastify.post(
    '/api/superadmin/users/:userId/restore',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const { userId } = userIdParamsSchema.parse(request.params);

        const { data: users, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, status, is_super_admin')
          .eq('id', userId)
          .order('tenant_id', { ascending: true })
          .limit(1);

        const targetUser = users?.[0];

        if (fetchError || !targetUser) {
          return reply.status(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        if (targetUser.status !== 'suspended' && targetUser.status !== 'deleted') {
          return reply.status(400).send({
            error: { code: 'NOT_ARCHIVED', message: `User is not archived (current status: ${targetUser.status})` },
          });
        }

        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ status: 'active' })
          .eq('id', userId);

        if (updateError) {
          request.log.error({ error: updateError, userId }, 'Failed to restore user');
          throw updateError;
        }

        request.log.info(
          { superAdminId: request.user?.id, restoredUserId: userId, restoredEmail: targetUser.email },
          'Super admin re-instated user'
        );

        return {
          success: true,
          message: `${targetUser.email} has been reactivated`,
          data: { id: userId, email: targetUser.email, status: 'active' },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: { code: 'INVALID_PARAMS', message: 'Invalid parameters' },
          });
        }
        request.log.error({ error }, 'Error restoring user');
        return reply.status(500).send({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to re-instate user' },
        });
      }
    }
  );

  /**
   * DELETE /api/superadmin/users/:userId/hard
   *
   * Permanently deletes a user (hard delete) - cannot be undone
   * This removes the user record from the database entirely
   */
  fastify.delete(
    '/api/superadmin/users/:userId/hard',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const { userId } = userIdParamsSchema.parse(request.params);

        // Verify user exists (handle multiple rows per ID)
        const { data: users, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, is_super_admin, status, tenant_id')
          .eq('id', userId)
          .order('tenant_id', { ascending: true })
          .limit(1);

        const targetUser = users?.[0];

        if (fetchError || !targetUser) {
          return reply.status(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        // Prevent deleting super admins
        if (targetUser.is_super_admin) {
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Cannot permanently delete a super admin user' },
          });
        }

        // Hard delete - remove the user record entirely
        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId)
          .eq('tenant_id', targetUser.tenant_id);

        if (deleteError) {
          request.log.error({ error: deleteError }, 'Failed to hard delete user');
          throw deleteError;
        }

        request.log.info(
          { superAdminId: request.user?.id, deletedUserId: userId, deletedEmail: targetUser.email },
          'Super admin permanently deleted user'
        );

        return {
          success: true,
          message: `User ${targetUser.email} has been permanently deleted`,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: { code: 'INVALID_PARAMS', message: 'Invalid parameters' },
          });
        }
        request.log.error({ error }, 'Error permanently deleting user');
        return reply.status(500).send({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to permanently delete user' },
        });
      }
    }
  );

  /**
   * POST /api/superadmin/users/:userId/recovery
   *
   * Sends a password reset email to the user via Supabase Auth SMTP.
   * Uses resetPasswordForEmail which triggers Supabase's email delivery.
   */
  fastify.post(
    '/api/superadmin/users/:userId/recovery',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const { userId } = userIdParamsSchema.parse(request.params);

        const { data: users, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, email, status')
          .eq('id', userId)
          .order('tenant_id', { ascending: true })
          .limit(1);

        const targetUser = users?.[0];

        if (fetchError || !targetUser) {
          return reply.status(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        if (targetUser.status === 'suspended') {
          return reply.status(400).send({
            error: { code: 'USER_ARCHIVED', message: 'Cannot send recovery email to an archived user. Re-instate them first.' },
          });
        }

        // resetPasswordForEmail triggers Supabase's SMTP delivery via email template.
        // Note: admin.generateLink() only returns a token — it does NOT send an email.
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
          targetUser.email,
          {
            redirectTo: `${process.env.FRONTEND_URL || 'https://www.tynebase.com'}/auth/update-password`,
          }
        );

        if (resetError) {
          request.log.error(
            { error: resetError, email: targetUser.email },
            'Failed to send password recovery email'
          );
          return reply.status(500).send({
            error: { code: 'EMAIL_SEND_FAILED', message: `Failed to send recovery email: ${resetError.message}` },
          });
        }

        request.log.info(
          { superAdminId: request.user?.id, targetUserId: userId, targetEmail: targetUser.email },
          'Super admin sent password recovery email'
        );

        return {
          success: true,
          message: `Password recovery email sent to ${targetUser.email}`,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: { code: 'INVALID_PARAMS', message: 'Invalid parameters' },
          });
        }
        request.log.error({ error }, 'Error sending recovery email');
        return reply.status(500).send({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send recovery email' },
        });
      }
    }
  );

  /**
   * POST /api/superadmin/users/:userId/credits
   * 
   * Assigns additional AI credits to the user's tenant credit pool
   */
  fastify.post(
    '/api/superadmin/users/:userId/credits',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const { userId } = userIdParamsSchema.parse(request.params);
        const { credits } = assignCreditsBodySchema.parse(request.body);

        // Get user and tenant (handle multiple rows per ID)
        const { data: users, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, email, tenant_id')
          .eq('id', userId)
          .order('tenant_id', { ascending: true })
          .limit(1);

        const targetUser = users?.[0];

        if (fetchError || !targetUser) {
          return reply.status(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        if (!targetUser.tenant_id) {
          return reply.status(400).send({
            error: { code: 'NO_TENANT', message: 'User has no associated tenant' },
          });
        }

        // Get current month's credit pool (pools are per-month)
        const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-04"
        const { data: pool, error: poolError } = await supabaseAdmin
          .from('credit_pools')
          .select('id, total_credits, used_credits')
          .eq('tenant_id', targetUser.tenant_id)
          .eq('month_year', currentMonth)
          .maybeSingle();

        if (poolError) {
          request.log.error({ error: poolError }, 'Failed to fetch credit pool');
          throw poolError;
        }

        if (!pool) {
          // Create a new credit pool for this month if it doesn't exist
          const { error: createError } = await supabaseAdmin
            .from('credit_pools')
            .insert({
              tenant_id: targetUser.tenant_id,
              month_year: currentMonth,
              total_credits: credits,
              used_credits: 0,
            });

          if (createError) {
            request.log.error({ error: createError }, 'Failed to create credit pool');
            throw createError;
          }

          return {
            success: true,
            message: `Created credit pool with ${credits} credits for tenant (${currentMonth})`,
            data: { total_credits: credits, used_credits: 0 },
          };
        }

        // Add credits to existing pool
        const newTotal = pool.total_credits + credits;
        const { error: updateError } = await supabaseAdmin
          .from('credit_pools')
          .update({ total_credits: newTotal })
          .eq('id', pool.id);

        if (updateError) {
          request.log.error({ error: updateError }, 'Failed to update credit pool');
          throw updateError;
        }

        request.log.info(
          {
            superAdminId: request.user?.id,
            targetUserId: userId,
            tenantId: targetUser.tenant_id,
            creditsAdded: credits,
            newTotal,
          },
          'Super admin assigned credits'
        );

        return {
          success: true,
          message: `Added ${credits} credits. New total: ${newTotal}`,
          data: { total_credits: newTotal, used_credits: pool.used_credits },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: { code: 'INVALID_PARAMS', message: 'Invalid parameters', details: error.errors },
          });
        }
        request.log.error({ error }, 'Error assigning credits');
        return reply.status(500).send({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to assign credits' },
        });
      }
    }
  );

  /**
   * GET /api/superadmin/kpis
   * 
   * Returns platform-wide KPIs for the admin dashboard
   */
  fastify.get(
    '/api/superadmin/kpis',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Parallel queries for all KPIs
        const [
          tenantsResult,
          usersResult,
          activeUsersResult,
          documentsResult,
          newUsersResult,
          newDocsResult,
          aiQueriesResult,
          creditPoolsResult,
        ] = await Promise.all([
          supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).neq('status', 'suspended'),
          supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('last_active_at', sevenDaysAgo.toISOString()).neq('status', 'suspended'),
          supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()).neq('status', 'suspended'),
          supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
          supabaseAdmin.from('query_usage').select('credits_charged').gte('created_at', thirtyDaysAgo.toISOString()),
          supabaseAdmin.from('credit_pools').select('total_credits, used_credits'),
        ]);

        const totalCreditsUsed = creditPoolsResult.data?.reduce((sum, p) => sum + (p.used_credits || 0), 0) || 0;
        const totalCreditsAllocated = creditPoolsResult.data?.reduce((sum, p) => sum + (p.total_credits || 0), 0) || 0;

        return {
          success: true,
          data: {
            totalTenants: tenantsResult.count || 0,
            totalUsers: usersResult.count || 0,
            activeUsers7d: activeUsersResult.count || 0,
            totalDocuments: documentsResult.count || 0,
            newUsersLast30d: newUsersResult.count || 0,
            newDocsLast30d: newDocsResult.count || 0,
            aiQueriesLast30d: aiQueriesResult.data?.length || 0,
            totalCreditsUsed,
            totalCreditsAllocated,
            creditUtilization: totalCreditsAllocated > 0 ? Math.round((totalCreditsUsed / totalCreditsAllocated) * 100) : 0,
          },
        };
      } catch (error) {
        request.log.error({ error }, 'Error retrieving KPIs');
        return reply.status(500).send({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve KPIs' },
        });
      }
    }
  );
}
