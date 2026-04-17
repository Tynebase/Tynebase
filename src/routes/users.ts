import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { sendRoleChangeEmail, sendUserRemovedEmail, sendUserLeftEmail, sendUserLeftAdminNotification } from '../services/email';
import { WORKSPACE_ROLE_INPUTS, normalizeWorkspaceRole } from '../lib/roles';
import { writeAuditLog, getClientIp } from '../lib/auditLog';

/**
 * Zod schema for GET /api/users query parameters
 */
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  role: z.enum(WORKSPACE_ROLE_INPUTS).optional().transform((role) => role ? normalizeWorkspaceRole(role) : undefined),
});

/**
 * Zod schema for PATCH /api/users/:id body parameters
 */
const updateUserBodySchema = z.object({
  role: z.enum(WORKSPACE_ROLE_INPUTS).optional().transform((role) => role ? normalizeWorkspaceRole(role) : undefined),
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
          .select('id, email, full_name, role, status, created_at, last_active_at, original_tenant_id', { count: 'exact' })
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

        // Fetch the authoritative workspace creator from tenants.created_by.
        // This replaces the old `original_tenant_id IS NULL` heuristic, which
        // misfired for freshly-invited admins (their row is legitimately
        // created with original_tenant_id = NULL when they have no prior
        // workspace, which made them look indistinguishable from the creator).
        let tenantCreatedBy: string | null = null;
        {
          const { data: tenantRow } = await supabaseAdmin
            .from('tenants')
            .select('created_by')
            .eq('id', tenant.id)
            .maybeSingle();
          tenantCreatedBy = (tenantRow as any)?.created_by || null;
        }

        // Enrich users with document counts and original admin flag
        const enrichedUsers = users?.map(u => ({
          ...u,
          role: normalizeWorkspaceRole(u.role as any),
          documents_count: documentCounts[u.id] || 0,
          is_original_admin: tenantCreatedBy
            ? u.id === tenantCreatedBy
            : u.role === 'admin' && u.original_tenant_id === null,
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
          .select('id, email, full_name, role, original_tenant_id')
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

        // Protect the workspace creator. Authoritative via tenants.created_by;
        // fall back to the legacy heuristic for pre-backfill tenants only.
        const { data: tenantCreator } = await supabaseAdmin
          .from('tenants')
          .select('created_by')
          .eq('id', tenant.id)
          .maybeSingle();
        const creatorId = (tenantCreator as any)?.created_by as string | null;
        const isOriginalAdmin = creatorId
          ? targetUser.id === creatorId
          : targetUser.role === 'admin' && targetUser.original_tenant_id === null;
        if (isOriginalAdmin && body.role && body.role !== 'admin') {
          return reply.code(403).send({
            error: { code: 'CANNOT_MODIFY_ORIGINAL_ADMIN', message: 'Cannot change the role of the original workspace administrator' },
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
            oldRole: normalizeWorkspaceRole(targetUser.role as any),
            newRole: normalizeWorkspaceRole(body.role as any),
            changedBy: currentUser.full_name || currentUser.email,
          }).catch(err => {
            fastify.log.error({ error: err, userId: id }, 'Failed to send role change email');
          });
        }

        return reply.code(200).send({ success: true, data: { user: { ...updatedUser, role: normalizeWorkspaceRole(updatedUser.role as any) } } });
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
          .select('id, email, full_name, role, original_tenant_id')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (fetchError || !targetUser) {
          return reply.code(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        // Protect the workspace creator from being removed. Authoritative via
        // tenants.created_by; fall back to the legacy heuristic only when the
        // column is NULL (pre-migration tenants).
        const { data: tenantCreator } = await supabaseAdmin
          .from('tenants')
          .select('created_by')
          .eq('id', tenant.id)
          .maybeSingle();
        const creatorId = (tenantCreator as any)?.created_by as string | null;
        const isOriginalAdmin = creatorId
          ? targetUser.id === creatorId
          : targetUser.role === 'admin' && targetUser.original_tenant_id === null;
        if (isOriginalAdmin) {
          return reply.code(403).send({
            error: { code: 'CANNOT_REMOVE_ORIGINAL_ADMIN', message: 'Cannot remove the original workspace administrator' },
          });
        }

        // Soft delete the membership from THIS workspace
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

        // Audit log the removal
        writeAuditLog({
          tenantId: tenant.id,
          actorId: currentUser.id,
          action: 'user.removed',
          actionType: 'user',
          targetName: targetUser.full_name || targetUser.email,
          ipAddress: getClientIp(request),
          metadata: { removed_user_id: id, removed_user_email: targetUser.email, removed_user_role: targetUser.role },
        });

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

        fastify.log.info({ userId: id, currentUserId: currentUser.id, tenantId: tenant.id, role: currentUser.role }, 'Leave workspace request received');

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

        // Get user's original tenant to restore them (handle multiple rows per ID)
        const { data: users, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, original_tenant_id, tenant_id')
          .eq('id', id)
          .order('tenant_id', { ascending: true })
          .limit(1);

        const userRecord = users?.[0];

        if (fetchError || !userRecord) {
          fastify.log.error({ error: fetchError, userId: id }, 'Failed to fetch user record');
          return reply.code(500).send({
            error: { code: 'LEAVE_FAILED', message: 'Failed to leave workspace' },
          });
        }

        // If user has an original workspace, restore them to it
        if (userRecord.original_tenant_id && userRecord.original_tenant_id !== tenant.id) {
          // Get the original tenant info
          const { data: originalTenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('id, subdomain, name')
            .eq('id', userRecord.original_tenant_id)
            .single();

          if (tenantError || !originalTenant) {
            // Original tenant no longer exists - soft delete instead.
            // IMPORTANT: scope by BOTH id AND tenant_id. The composite PK
            // means omitting tenant_id would rewrite every row this user
            // owns across all tenants — the exact multi-tenant auth
            // regression class this codebase has hit before.
            fastify.log.warn({ userId: id, originalTenantId: userRecord.original_tenant_id }, 'Original tenant not found, soft deleting user');
            await supabaseAdmin
              .from('users')
              .update({ status: 'deleted' })
              .eq('id', id)
              .eq('tenant_id', tenant.id);

            return reply.code(200).send({
              success: true,
              data: {
                message: 'Left workspace. Your original workspace no longer exists.',
                restored: false,
              },
            });
          }

          // Restore user to their original workspace.
          //
          // The user has (or had) a row in their original tenant plus a row
          // in the current tenant they're leaving. Both rows are independent
          // under the composite PK `(id, tenant_id)`.
          //
          // CRITICAL: the previous implementation did
          //   .update({ tenant_id: original_tenant_id, ... }).eq('id', id)
          // which (a) touched EVERY row the user owns across all tenants,
          // wiping memberships, and (b) tried to change `tenant_id`, which is
          // part of the composite PK and would collide with the existing
          // original-tenant row. That's the exact invariant MEMORY.md warns
          // about. Fix: scoped delete of the row in the tenant being left,
          // then scoped upsert/update on the original-tenant row.
          const { error: leaveError } = await supabaseAdmin
            .from('users')
            .update({ status: 'deleted' })
            .eq('id', id)
            .eq('tenant_id', tenant.id);

          if (leaveError) {
            fastify.log.error({ error: leaveError, userId: id, tenantId: tenant.id }, 'Failed to mark membership deleted');
            return reply.code(500).send({
              error: { code: 'LEAVE_FAILED', message: 'Failed to leave workspace' },
            });
          }

          // Ensure the original-tenant row exists and is active. We upsert
          // scoped to (id, tenant_id) so we never disturb other memberships.
          const { data: homeRow } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', id)
            .eq('tenant_id', userRecord.original_tenant_id)
            .maybeSingle();

          if (homeRow) {
            const { error: restoreError } = await supabaseAdmin
              .from('users')
              .update({
                status: 'active',
                // NOTE: is_super_admin intentionally omitted — platform flag.
              })
              .eq('id', id)
              .eq('tenant_id', userRecord.original_tenant_id);
            if (restoreError) {
              fastify.log.error({ error: restoreError, userId: id }, 'Failed to reactivate home-workspace row');
            }
          } else {
            // Home row is gone (e.g., originally soft-deleted). Recreate it.
            const { error: insertError } = await supabaseAdmin
              .from('users')
              .insert({
                id,
                tenant_id: userRecord.original_tenant_id,
                email: currentUser.email,
                full_name: currentUser.full_name,
                role: 'admin',
                status: 'active',
              });
            if (insertError) {
              fastify.log.error({ error: insertError, userId: id }, 'Failed to recreate home-workspace row');
            }
          }

          // Update Supabase Auth user_metadata with restored tenant info
          await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: {
              tenant_id: originalTenant.id,
              tenant_subdomain: originalTenant.subdomain,
              tenant_name: originalTenant.name,
              role: 'admin',
            },
          });

          fastify.log.info({ userId: id, fromTenantId: tenant.id, toTenantId: originalTenant.id }, 'User restored to original workspace');

          writeAuditLog({
            tenantId: tenant.id,
            actorId: currentUser.id,
            action: 'user.left_workspace',
            actionType: 'user',
            targetName: currentUser.full_name || currentUser.email,
            ipAddress: getClientIp(request),
            metadata: { user_id: id, restored_to_tenant_id: originalTenant.id },
          });

          // Send leave emails (fire and forget)
          const leavingUserName = currentUser.full_name || currentUser.email.split('@')[0];
          sendUserLeftEmail({
            to: currentUser.email,
            userName: leavingUserName,
            tenantName: tenant.name,
            restored: true,
            restoredTenantName: originalTenant.name,
          }).catch(err => fastify.log.error({ error: err }, 'Failed to send user left email'));

          // Notify admins
          supabaseAdmin
            .from('users')
            .select('email, full_name')
            .eq('tenant_id', tenant.id)
            .eq('role', 'admin')
            .eq('status', 'active')
            .then(({ data: admins }) => {
              if (admins) {
                for (const admin of admins) {
                  sendUserLeftAdminNotification({
                    to: admin.email,
                    adminName: admin.full_name || admin.email.split('@')[0],
                    userName: leavingUserName,
                    userEmail: currentUser.email,
                    tenantName: tenant.name,
                  }).catch(err => fastify.log.error({ error: err }, 'Failed to send admin leave notification'));
                }
              }
            });

          return reply.code(200).send({
            success: true,
            data: {
              message: `Successfully left workspace. You have been restored to your original workspace: ${originalTenant.name}`,
              restored: true,
              tenant: {
                id: originalTenant.id,
                subdomain: originalTenant.subdomain,
                name: originalTenant.name,
              },
            },
          });
        }

        // No original workspace - this is their home workspace, soft delete
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

        fastify.log.info({ userId: id, tenantId: tenant.id }, 'User left workspace (no original to restore)');

        writeAuditLog({
          tenantId: tenant.id,
          actorId: currentUser.id,
          action: 'user.left_workspace',
          actionType: 'user',
          targetName: currentUser.full_name || currentUser.email,
          ipAddress: getClientIp(request),
          metadata: { user_id: id, restored: false },
        });

        // Send leave emails (fire and forget)
        const leavingUserName = currentUser.full_name || currentUser.email.split('@')[0];
        sendUserLeftEmail({
          to: currentUser.email,
          userName: leavingUserName,
          tenantName: tenant.name,
          restored: false,
        }).catch(err => fastify.log.error({ error: err }, 'Failed to send user left email'));

        // Notify admins
        supabaseAdmin
          .from('users')
          .select('email, full_name')
          .eq('tenant_id', tenant.id)
          .eq('role', 'admin')
          .eq('status', 'active')
          .then(({ data: admins }) => {
            if (admins) {
              for (const admin of admins) {
                sendUserLeftAdminNotification({
                  to: admin.email,
                  adminName: admin.full_name || admin.email.split('@')[0],
                  userName: leavingUserName,
                  userEmail: currentUser.email,
                  tenantName: tenant.name,
                }).catch(err => fastify.log.error({ error: err }, 'Failed to send admin leave notification'));
              }
            }
          });

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Successfully left workspace',
            restored: false,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error in leave workspace endpoint');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
        });
      }
    }
  );
}
