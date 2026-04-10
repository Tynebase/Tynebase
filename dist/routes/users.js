"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = usersRoutes;
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const membershipGuard_1 = require("../middleware/membershipGuard");
const email_1 = require("../services/email");
const roles_1 = require("../lib/roles");
/**
 * Zod schema for GET /api/users query parameters
 */
const listUsersQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    status: zod_1.z.enum(['active', 'suspended', 'deleted']).optional(),
    role: zod_1.z.enum(roles_1.WORKSPACE_ROLE_INPUTS).optional().transform((role) => role ? (0, roles_1.normalizeWorkspaceRole)(role) : undefined),
});
/**
 * Zod schema for PATCH /api/users/:id body parameters
 */
const updateUserBodySchema = zod_1.z.object({
    role: zod_1.z.enum(roles_1.WORKSPACE_ROLE_INPUTS).optional().transform((role) => role ? (0, roles_1.normalizeWorkspaceRole)(role) : undefined),
    status: zod_1.z.enum(['active', 'suspended']).optional(),
    full_name: zod_1.z.string().min(1).max(100).optional(),
});
/**
 * Users management routes
 */
async function usersRoutes(fastify) {
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
    fastify.get('/api/users', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            // Validate query parameters
            const query = listUsersQuerySchema.parse(request.query);
            const { page, limit, status, role } = query;
            // Calculate pagination offset
            const offset = (page - 1) * limit;
            // Build query for users in tenant
            let usersQuery = supabase_1.supabaseAdmin
                .from('users')
                .select('id, email, full_name, role, status, created_at, last_active_at, original_tenant_id', { count: 'exact' })
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false });
            // Apply filters - default to excluding deleted users
            if (status) {
                usersQuery = usersQuery.eq('status', status);
            }
            else {
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
            let documentCounts = {};
            if (userIds.length > 0) {
                const { data: docCounts, error: docError } = await supabase_1.supabaseAdmin
                    .from('documents')
                    .select('author_id')
                    .eq('tenant_id', tenant.id)
                    .in('author_id', userIds);
                if (!docError && docCounts) {
                    documentCounts = docCounts.reduce((acc, doc) => {
                        acc[doc.author_id] = (acc[doc.author_id] || 0) + 1;
                        return acc;
                    }, {});
                }
            }
            // Enrich users with document counts and original admin flag
            const enrichedUsers = users?.map(u => ({
                ...u,
                role: (0, roles_1.normalizeWorkspaceRole)(u.role),
                documents_count: documentCounts[u.id] || 0,
                is_original_admin: u.role === 'admin' && u.original_tenant_id === null,
            })) || [];
            const total = count || 0;
            const totalPages = Math.ceil(total / limit);
            fastify.log.info({ tenantId: tenant.id, userId: user.id, userCount: enrichedUsers.length }, 'Users fetched successfully');
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
            fastify.log.error({ error }, 'Unexpected error in GET /api/users');
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
     * PATCH /api/users/:id
     * Updates a user's role or status
     */
    fastify.patch('/api/users/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const currentUser = request.user;
            const { id } = request.params;
            if (currentUser.role !== 'admin' && !currentUser.is_super_admin) {
                return reply.code(403).send({
                    error: { code: 'FORBIDDEN', message: 'Only admins can update users' },
                });
            }
            const body = updateUserBodySchema.parse(request.body);
            const { data: targetUser, error: fetchError } = await supabase_1.supabaseAdmin
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
            // Protect original admin: user whose original_tenant_id is NULL is the workspace creator
            const isOriginalAdmin = targetUser.role === 'admin' && targetUser.original_tenant_id === null;
            if (isOriginalAdmin && body.role && body.role !== 'admin') {
                return reply.code(403).send({
                    error: { code: 'CANNOT_MODIFY_ORIGINAL_ADMIN', message: 'Cannot change the role of the original workspace administrator' },
                });
            }
            const updateData = {};
            if (body.role)
                updateData.role = body.role;
            if (body.status)
                updateData.status = body.status;
            if (body.full_name)
                updateData.full_name = body.full_name;
            if (Object.keys(updateData).length === 0) {
                return reply.code(400).send({
                    error: { code: 'NO_CHANGES', message: 'No valid fields to update' },
                });
            }
            const { data: updatedUser, error: updateError } = await supabase_1.supabaseAdmin
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
                (0, email_1.sendRoleChangeEmail)({
                    to: updatedUser.email,
                    userName: updatedUser.full_name || updatedUser.email.split('@')[0],
                    tenantName: tenant.name,
                    oldRole: (0, roles_1.normalizeWorkspaceRole)(targetUser.role),
                    newRole: (0, roles_1.normalizeWorkspaceRole)(body.role),
                    changedBy: currentUser.full_name || currentUser.email,
                }).catch(err => {
                    fastify.log.error({ error: err, userId: id }, 'Failed to send role change email');
                });
            }
            return reply.code(200).send({ success: true, data: { user: { ...updatedUser, role: (0, roles_1.normalizeWorkspaceRole)(updatedUser.role) } } });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.errors },
                });
            }
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
            });
        }
    });
    /**
     * DELETE /api/users/:id
     * Removes a user from the tenant
     */
    fastify.delete('/api/users/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const currentUser = request.user;
            const { id } = request.params;
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
            const { data: targetUser, error: fetchError } = await supabase_1.supabaseAdmin
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
            // Protect original admin from being removed
            const isOriginalAdmin = targetUser.role === 'admin' && targetUser.original_tenant_id === null;
            if (isOriginalAdmin) {
                return reply.code(403).send({
                    error: { code: 'CANNOT_REMOVE_ORIGINAL_ADMIN', message: 'Cannot remove the original workspace administrator' },
                });
            }
            // If target user has an original_tenant_id, restore them to their original workspace
            if (targetUser.original_tenant_id) {
                const { data: originalTenant } = await supabase_1.supabaseAdmin
                    .from('tenants')
                    .select('id, subdomain, name')
                    .eq('id', targetUser.original_tenant_id)
                    .single();
                if (originalTenant) {
                    // Restore user to their original workspace as admin
                    await supabase_1.supabaseAdmin
                        .from('users')
                        .update({
                        tenant_id: targetUser.original_tenant_id,
                        original_tenant_id: null,
                        role: 'admin',
                        status: 'active',
                    })
                        .eq('id', id);
                    // Update Supabase Auth metadata
                    await supabase_1.supabaseAdmin.auth.admin.updateUserById(id, {
                        user_metadata: {
                            tenant_id: originalTenant.id,
                            tenant_subdomain: originalTenant.subdomain,
                            tenant_name: originalTenant.name,
                            role: 'admin',
                        },
                    });
                    fastify.log.info({ userId: id, restoredTo: originalTenant.id }, 'Removed user restored to original workspace');
                }
                else {
                    // Original tenant no longer exists - soft delete
                    await supabase_1.supabaseAdmin
                        .from('users')
                        .update({ status: 'deleted' })
                        .eq('id', id)
                        .eq('tenant_id', tenant.id);
                }
            }
            else {
                // No original workspace - soft delete
                await supabase_1.supabaseAdmin
                    .from('users')
                    .update({ status: 'deleted' })
                    .eq('id', id)
                    .eq('tenant_id', tenant.id);
            }
            const deleteError = null; // Handled above
            if (deleteError) {
                return reply.code(500).send({
                    error: { code: 'DELETE_FAILED', message: 'Failed to remove user' },
                });
            }
            // Send email notification to removed user
            (0, email_1.sendUserRemovedEmail)({
                to: targetUser.email,
                userName: targetUser.full_name || targetUser.email.split('@')[0],
                tenantName: tenant.name,
                removedBy: currentUser.full_name || currentUser.email,
            }).catch(err => {
                fastify.log.error({ error: err, userId: id }, 'Failed to send user removed email');
            });
            return reply.code(200).send({ success: true, data: { message: 'User removed' } });
        }
        catch (error) {
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
            });
        }
    });
    /**
     * DELETE /api/users/:id/leave
     * Allows a user to leave a workspace (remove themselves)
     * Only works if the user is removing themselves and is not an admin
     */
    fastify.delete('/api/users/:id/leave', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            const tenant = request.tenant;
            const currentUser = request.user;
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
            const { data: users, error: fetchError } = await supabase_1.supabaseAdmin
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
                const { data: originalTenant, error: tenantError } = await supabase_1.supabaseAdmin
                    .from('tenants')
                    .select('id, subdomain, name')
                    .eq('id', userRecord.original_tenant_id)
                    .single();
                if (tenantError || !originalTenant) {
                    // Original tenant no longer exists - soft delete instead
                    fastify.log.warn({ userId: id, originalTenantId: userRecord.original_tenant_id }, 'Original tenant not found, soft deleting user');
                    await supabase_1.supabaseAdmin
                        .from('users')
                        .update({ status: 'deleted' })
                        .eq('id', id);
                    return reply.code(200).send({
                        success: true,
                        data: {
                            message: 'Left workspace. Your original workspace no longer exists.',
                            restored: false,
                        },
                    });
                }
                // Restore user to their original workspace
                const { error: restoreError } = await supabase_1.supabaseAdmin
                    .from('users')
                    .update({
                    tenant_id: userRecord.original_tenant_id,
                    original_tenant_id: null, // Clear since they're back home
                    role: 'admin', // Restore as admin of their own workspace
                    status: 'active',
                })
                    .eq('id', id);
                if (restoreError) {
                    fastify.log.error({ error: restoreError, userId: id }, 'Failed to restore user to original workspace');
                    return reply.code(500).send({
                        error: { code: 'LEAVE_FAILED', message: 'Failed to leave workspace' },
                    });
                }
                // Update Supabase Auth user_metadata with restored tenant info
                await supabase_1.supabaseAdmin.auth.admin.updateUserById(id, {
                    user_metadata: {
                        tenant_id: originalTenant.id,
                        tenant_subdomain: originalTenant.subdomain,
                        tenant_name: originalTenant.name,
                        role: 'admin',
                    },
                });
                fastify.log.info({ userId: id, fromTenantId: tenant.id, toTenantId: originalTenant.id }, 'User restored to original workspace');
                // Send leave emails (fire and forget)
                const leavingUserName = currentUser.full_name || currentUser.email.split('@')[0];
                (0, email_1.sendUserLeftEmail)({
                    to: currentUser.email,
                    userName: leavingUserName,
                    tenantName: tenant.name,
                    restored: true,
                    restoredTenantName: originalTenant.name,
                }).catch(err => fastify.log.error({ error: err }, 'Failed to send user left email'));
                // Notify admins
                supabase_1.supabaseAdmin
                    .from('users')
                    .select('email, full_name')
                    .eq('tenant_id', tenant.id)
                    .eq('role', 'admin')
                    .eq('status', 'active')
                    .then(({ data: admins }) => {
                    if (admins) {
                        for (const admin of admins) {
                            (0, email_1.sendUserLeftAdminNotification)({
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
            const { error: deleteError } = await supabase_1.supabaseAdmin
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
            // Send leave emails (fire and forget)
            const leavingUserName = currentUser.full_name || currentUser.email.split('@')[0];
            (0, email_1.sendUserLeftEmail)({
                to: currentUser.email,
                userName: leavingUserName,
                tenantName: tenant.name,
                restored: false,
            }).catch(err => fastify.log.error({ error: err }, 'Failed to send user left email'));
            // Notify admins
            supabase_1.supabaseAdmin
                .from('users')
                .select('email, full_name')
                .eq('tenant_id', tenant.id)
                .eq('role', 'admin')
                .eq('status', 'active')
                .then(({ data: admins }) => {
                if (admins) {
                    for (const admin of admins) {
                        (0, email_1.sendUserLeftAdminNotification)({
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
        }
        catch (error) {
            fastify.log.error({ error }, 'Error in leave workspace endpoint');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
            });
        }
    });
}
//# sourceMappingURL=users.js.map