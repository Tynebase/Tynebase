import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { writeAuditLog, getClientIp } from '../lib/auditLog';
import { sendWelcomeEmail } from '../services/email';

/**
 * User limits per subscription tier
 */
const TIER_USER_LIMITS: Record<string, number> = {
  free: 1,
  base: 10,
  pro: 50,
  enterprise: Infinity,
};

/**
 * Get the user limit for a given tier
 */
function getUserLimitForTier(tier: string): number {
  return TIER_USER_LIMITS[tier] ?? 1;
}

/**
 * Zod schema for POST /api/invites request body
 */
const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  role: z.enum(['admin', 'editor', 'member', 'viewer']).default('member'),
});

/**
 * Zod schema for POST /api/invites/accept request body
 */
const acceptInviteSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role: z.enum(['admin', 'editor', 'member', 'viewer']),
  full_name: z.string().trim().max(100, 'Name must be 100 characters or less').optional(),
});

/**
 * Invites management routes
 */
export default async function invitesRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/invites
   * Invite a user to the tenant
   * 
   * Uses Supabase's built-in invite functionality to send an email.
   * The invited user will receive a magic link to join the tenant.
   * 
   * Request Body:
   * - email: Email address to invite
   * - role: Role to assign (admin, editor, member, viewer)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be admin of tenant
   */
  fastify.post(
    '/api/invites',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Only admins (or super admins) can invite users
        if (user.role !== 'admin' && !user.is_super_admin) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admins can invite users',
              details: {},
            },
          });
        }

        // Validate request body
        const body = inviteUserSchema.parse(request.body);
        const { email, role } = body;

        // Prevent self-invite
        if (email.toLowerCase() === user.email.toLowerCase()) {
          return reply.code(400).send({
            error: {
              code: 'SELF_INVITE',
              message: 'You cannot invite yourself',
              details: {},
            },
          });
        }

        // Check user limit for tenant's tier
        const userLimit = getUserLimitForTier(tenant.tier);
        const { count: currentUserCount } = await supabaseAdmin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'active');

        // Also count pending invites towards the limit
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const pendingInviteCount = authUsers?.users?.filter(
          u => u.user_metadata?.tenant_id === tenant.id && !u.email_confirmed_at
        ).length || 0;

        const totalUsers = (currentUserCount || 0) + pendingInviteCount;

        if (totalUsers >= userLimit) {
          return reply.code(403).send({
            error: {
              code: 'USER_LIMIT_REACHED',
              message: `Your ${tenant.tier} plan allows up to ${userLimit} user${userLimit === 1 ? '' : 's'}. Please upgrade to invite more team members.`,
              details: { currentUsers: currentUserCount, pendingInvites: pendingInviteCount, limit: userLimit },
            },
          });
        }

        // Check if user already exists in tenant
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id, email, status')
          .eq('email', email)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (existingUser) {
          // If user was soft-deleted, reactivate them
          if (existingUser.status === 'deleted') {
            const { error: reactivateError } = await supabaseAdmin
              .from('users')
              .update({ status: 'active', role: role })
              .eq('id', existingUser.id);

            if (reactivateError) {
              fastify.log.error({ error: reactivateError, userId: existingUser.id }, 'Failed to reactivate user');
              return reply.code(500).send({
                error: {
                  code: 'REACTIVATE_FAILED',
                  message: 'Failed to reactivate user',
                  details: {},
                },
              });
            }

            fastify.log.info({ userId: existingUser.id, tenantId: tenant.id }, 'Soft-deleted user reactivated');

            writeAuditLog({
              tenantId: tenant.id,
              actorId: user.id,
              action: 'user.reactivated',
              actionType: 'user',
              targetName: email,
              ipAddress: getClientIp(request),
              metadata: { role },
            });

            return reply.code(200).send({
              success: true,
              data: {
                message: 'User reactivated successfully',
                added_email: email,
                role: role,
              },
            });
          }

          // User exists and is active/suspended - can't re-invite
          return reply.code(400).send({
            error: {
              code: 'USER_EXISTS',
              message: 'User with this email already exists in this workspace',
              details: {},
            },
          });
        }

        // Check if user already exists in Supabase Auth
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = allUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        // If user exists in Auth and is confirmed, add them directly to this tenant
        if (existingAuthUser && existingAuthUser.email_confirmed_at) {
          // Check if they're already in another tenant's users table
          const { data: existingUserRecord, error: lookupError } = await supabaseAdmin
            .from('users')
            .select('id, tenant_id')
            .eq('id', existingAuthUser.id)
            .maybeSingle();

          if (existingUserRecord && !lookupError) {
            // User already belongs to a tenant - move them to the new one by updating tenant_id
            const { data: movedUser, error: moveError } = await supabaseAdmin
              .from('users')
              .update({
                tenant_id: tenant.id,
                role: role,
                status: 'active',
              })
              .eq('id', existingAuthUser.id)
              .select()
              .single();

            if (moveError) {
              fastify.log.error({ error: moveError, userId: existingAuthUser.id }, 'Failed to move user to new tenant');
              return reply.code(500).send({
                error: {
                  code: 'MOVE_USER_FAILED',
                  message: 'Failed to move user to new workspace',
                  details: {},
                },
              });
            }

            // Update Supabase Auth user_metadata with new tenant info
            await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
              user_metadata: {
                ...existingAuthUser.user_metadata,
                tenant_id: tenant.id,
                tenant_subdomain: tenant.subdomain,
                tenant_name: tenant.name,
                role: role,
              },
            });

            fastify.log.info(
              { userId: existingAuthUser.id, oldTenantId: existingUserRecord.tenant_id, newTenantId: tenant.id, addedBy: user.id },
              'User moved from old tenant to new tenant'
            );

            writeAuditLog({
              tenantId: tenant.id,
              actorId: user.id,
              action: 'user.added',
              actionType: 'user',
              targetName: email,
              ipAddress: getClientIp(request),
              metadata: { role, moved_from_tenant: existingUserRecord.tenant_id },
            });

            // Send welcome email to the moved user
            sendWelcomeEmail({
              to: email,
              userName: movedUser.full_name || email.split('@')[0],
              tenantName: tenant.name,
              role: role,
              addedBy: user.full_name || user.email,
              loginUrl: `https://www.tynebase.com/login`,
            }).catch(err => {
              fastify.log.error({ error: err, email }, 'Failed to send welcome email');
            });

            return reply.code(200).send({
              success: true,
              data: {
                message: 'User moved to workspace successfully',
                added_email: email,
                user: movedUser,
              },
            });
          }

          // User exists in Auth but not in any tenant - add them directly
          const { data: newUser, error: createError } = await supabaseAdmin
            .from('users')
            .insert({
              id: existingAuthUser.id,
              tenant_id: tenant.id,
              email: email,
              full_name: existingAuthUser.user_metadata?.full_name || null,
              role: role,
              status: 'active',
            })
            .select()
            .single();

          if (createError) {
            fastify.log.error({ error: createError, email, tenantId: tenant.id }, 'Failed to add existing user to tenant');
            return reply.code(500).send({
              error: {
                code: 'ADD_USER_FAILED',
                message: 'Failed to add user to workspace',
                details: {},
              },
            });
          }

          // Create default user consents
          await supabaseAdmin
            .from('user_consents')
            .insert({
              user_id: existingAuthUser.id,
              ai_processing: true,
              analytics_tracking: true,
              knowledge_indexing: true,
            });

          // Update Supabase Auth user_metadata with new tenant info
          await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
            user_metadata: {
              ...existingAuthUser.user_metadata,
              tenant_id: tenant.id,
              tenant_subdomain: tenant.subdomain,
              tenant_name: tenant.name,
              role: role,
            },
          });

          fastify.log.info(
            { email, role, tenantId: tenant.id, userId: existingAuthUser.id, addedBy: user.id },
            'Existing user added to tenant directly'
          );

          writeAuditLog({
            tenantId: tenant.id,
            actorId: user.id,
            action: 'user.added',
            actionType: 'user',
            targetName: email,
            ipAddress: getClientIp(request),
            metadata: { role, existing_user: true },
          });

          // Send welcome email to the added user
          sendWelcomeEmail({
            to: email,
            userName: newUser.full_name || email.split('@')[0],
            tenantName: tenant.name,
            role: role,
            addedBy: user.full_name || user.email,
            loginUrl: `https://www.tynebase.com/login`,
          }).catch(err => {
            fastify.log.error({ error: err, email }, 'Failed to send welcome email');
          });

          return reply.code(200).send({
            success: true,
            data: {
              message: 'User added to workspace successfully',
              added_email: email,
              user: newUser,
            },
          });
        }

        // Check if there's already a pending invite for this email to this tenant
        const existingPendingInvite = existingAuthUser && 
          existingAuthUser.user_metadata?.tenant_id === tenant.id && 
          !existingAuthUser.email_confirmed_at;

        if (existingPendingInvite) {
          return reply.code(400).send({
            error: {
              code: 'INVITE_PENDING',
              message: 'An invitation has already been sent to this email. Use the Resend option to send another email.',
              details: {},
            },
          });
        }

        // Use Supabase's invite functionality for new users
        // This sends a magic link email to the user
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: {
            tenant_id: tenant.id,
            tenant_subdomain: tenant.subdomain,
            tenant_name: tenant.name,
            role: role,
            invited_by: user.id,
            invited_by_name: user.full_name || user.email,
          },
          redirectTo: `${process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim() || 'https://tynebase.vercel.app'}/auth/callback?tenant=${tenant.subdomain}`,
        });

        if (inviteError) {
          fastify.log.error({ 
            error: inviteError, 
            errorMessage: inviteError.message,
            errorStatus: (inviteError as any).status,
            errorCode: (inviteError as any).code,
            email, 
            tenantId: tenant.id 
          }, 'Failed to send invite');
          
          // Handle specific Supabase errors
          const errMsg = inviteError.message?.toLowerCase() || '';
          if (errMsg.includes('already registered') || errMsg.includes('already been registered') || errMsg.includes('user already exists') || errMsg.includes('email address already')) {
            return reply.code(400).send({
              error: {
                code: 'EMAIL_EXISTS',
                message: 'This email is already registered. The user may already have a TyneBase account. They can log in and be added to your workspace, or use a different email address.',
                details: {},
              },
            });
          }

          // Handle rate limiting
          if (inviteError.message?.includes('rate limit') || (inviteError as any).status === 429) {
            return reply.code(429).send({
              error: {
                code: 'RATE_LIMITED',
                message: 'Too many invite requests. Please wait a moment and try again.',
                details: {},
              },
            });
          }

          return reply.code(500).send({
            error: {
              code: 'INVITE_FAILED',
              message: inviteError.message || 'Failed to send invitation email',
              details: {},
            },
          });
        }

        fastify.log.info(
          { email, role, tenantId: tenant.id, invitedBy: user.id },
          'User invitation sent successfully'
        );

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'user.invited',
          actionType: 'user',
          targetName: email,
          ipAddress: getClientIp(request),
          metadata: { role },
        });

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Invitation sent successfully',
            invited_email: email,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in POST /api/invites');
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
   * POST /api/invites/accept
   * Accept an invitation and create user record
   * 
   * Called after a user clicks the invite link and authenticates.
   * Creates the user record in the users table with correct tenant and role.
   * 
   * Request Body:
   * - user_id: The authenticated user's ID
   * - tenant_id: The tenant they're joining
   * - role: The role assigned to them
   * - full_name: Optional display name
   * 
   * Authorization:
   * - Requires valid JWT matching the user_id
   */
  fastify.post(
    '/api/invites/accept',
    {
      preHandler: [rateLimitMiddleware],
    },
    async (request, reply) => {
      try {
        // Get auth token
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Missing or invalid authorization header',
              details: {},
            },
          });
        }

        const token = authHeader.substring(7);
        const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !authUser) {
          return reply.code(401).send({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid or expired token',
              details: {},
            },
          });
        }

        // Validate request body
        const body = acceptInviteSchema.parse(request.body);
        const { user_id, tenant_id, role, full_name } = body;

        // Ensure the authenticated user matches the user_id in the request
        if (authUser.id !== user_id) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'User ID mismatch',
              details: {},
            },
          });
        }

        // Validate that the tenant_id and role match what's in the user's metadata
        // This prevents tampering with the invite data
        const metadataTenantId = authUser.user_metadata?.tenant_id;
        const metadataRole = authUser.user_metadata?.role;

        if (!metadataTenantId || !metadataRole) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_INVITE',
              message: 'No valid invitation found for this user',
              details: {},
            },
          });
        }

        if (metadataTenantId !== tenant_id) {
          return reply.code(403).send({
            error: {
              code: 'TENANT_MISMATCH',
              message: 'Tenant ID does not match the invitation',
              details: {},
            },
          });
        }

        if (metadataRole !== role) {
          return reply.code(403).send({
            error: {
              code: 'ROLE_MISMATCH',
              message: 'Role does not match the invitation',
              details: {},
            },
          });
        }

        // Check if user record already exists
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', user_id)
          .single();

        if (existingUser) {
          return reply.code(400).send({
            error: {
              code: 'USER_EXISTS',
              message: 'User record already exists',
              details: {},
            },
          });
        }

        // Verify tenant exists and get tier for limit check
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier')
          .eq('id', tenant_id)
          .single();

        if (tenantError || !tenant) {
          return reply.code(404).send({
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Tenant not found',
              details: {},
            },
          });
        }

        // Double-check user limit (in case tier changed since invite was sent)
        const userLimit = getUserLimitForTier(tenant.tier);
        const { count: currentUserCount } = await supabaseAdmin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant_id)
          .eq('status', 'active');

        if ((currentUserCount || 0) >= userLimit) {
          return reply.code(403).send({
            error: {
              code: 'USER_LIMIT_REACHED',
              message: `This workspace has reached its user limit. Please contact the workspace administrator to upgrade the plan.`,
              details: { currentUsers: currentUserCount, limit: userLimit },
            },
          });
        }

        // Create user record
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            id: user_id,
            tenant_id: tenant_id,
            email: authUser.email,
            full_name: full_name || authUser.user_metadata?.full_name || null,
            role: role,
            status: 'active',
          })
          .select()
          .single();

        if (createError) {
          fastify.log.error({ error: createError, userId: user_id, tenantId: tenant_id }, 'Failed to create user record');
          return reply.code(500).send({
            error: {
              code: 'CREATE_FAILED',
              message: 'Failed to create user record',
              details: {},
            },
          });
        }

        // Create default user consents
        await supabaseAdmin
          .from('user_consents')
          .insert({
            user_id: user_id,
            ai_processing: true,
            analytics_tracking: true,
            knowledge_indexing: true,
          });

        fastify.log.info(
          { userId: user_id, tenantId: tenant_id, role },
          'User accepted invite and joined tenant'
        );

        writeAuditLog({
          tenantId: tenant_id,
          actorId: user_id,
          action: 'user.invite_accepted',
          actionType: 'user',
          targetName: authUser.email || null,
          ipAddress: getClientIp(request),
          metadata: { role },
        });

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Successfully joined the workspace',
            user: newUser,
            tenant: {
              id: tenant.id,
              subdomain: tenant.subdomain,
              name: tenant.name,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors,
            },
          });
        }

        fastify.log.error({ error }, 'Unexpected error in POST /api/invites/accept');
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
   * GET /api/invites/pending
   * List pending invitations for the tenant
   * 
   * Returns users who have been invited but haven't confirmed yet.
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be admin of tenant
   */
  fastify.get(
    '/api/invites/pending',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Only admins (or super admins) can view pending invites
        if (user.role !== 'admin' && !user.is_super_admin) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admins can view pending invites',
              details: {},
            },
          });
        }

        // Query auth.users for pending invites to this tenant
        const { data: pendingUsers, error } = await supabaseAdmin.auth.admin.listUsers();

        if (error) {
          fastify.log.error({ error, tenantId: tenant.id }, 'Failed to list pending invites');
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch pending invites',
              details: {},
            },
          });
        }

        // Filter for users invited to this tenant who haven't confirmed
        const pendingInvites = pendingUsers.users
          .filter(u => 
            u.user_metadata?.tenant_id === tenant.id && 
            !u.email_confirmed_at
          )
          .map(u => ({
            id: u.id,
            email: u.email,
            role: u.user_metadata?.role || 'member',
            invited_by: u.user_metadata?.invited_by_name || 'Unknown',
            created_at: u.created_at,
          }));

        return reply.code(200).send({
          success: true,
          data: {
            invites: pendingInvites,
            count: pendingInvites.length,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/invites/pending');
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
   * DELETE /api/invites/:id
   * Cancel a pending invitation
   * 
   * Deletes the unconfirmed user from auth.users.
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be admin of tenant
   */
  fastify.delete(
    '/api/invites/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        // Only admins (or super admins) can cancel invites
        if (user.role !== 'admin' && !user.is_super_admin) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admins can cancel invites',
              details: {},
            },
          });
        }

        // Verify the invite belongs to this tenant
        const { data: invitedUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(id);

        if (fetchError || !invitedUser?.user) {
          return reply.code(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Invitation not found',
              details: {},
            },
          });
        }

        // Check tenant ownership and that user hasn't confirmed
        if (invitedUser.user.user_metadata?.tenant_id !== tenant.id) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'This invitation does not belong to your workspace',
              details: {},
            },
          });
        }

        if (invitedUser.user.email_confirmed_at) {
          return reply.code(400).send({
            error: {
              code: 'ALREADY_CONFIRMED',
              message: 'This user has already accepted the invitation',
              details: {},
            },
          });
        }

        // Delete the unconfirmed user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (deleteError) {
          fastify.log.error({ error: deleteError, userId: id }, 'Failed to cancel invite');
          return reply.code(500).send({
            error: {
              code: 'DELETE_FAILED',
              message: 'Failed to cancel invitation',
              details: {},
            },
          });
        }

        fastify.log.info(
          { inviteId: id, email: invitedUser.user.email, tenantId: tenant.id, cancelledBy: user.id },
          'Invitation cancelled'
        );

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'user.invite_cancelled',
          actionType: 'user',
          targetName: invitedUser.user.email || null,
          ipAddress: getClientIp(request),
          metadata: {},
        });

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Invitation cancelled successfully',
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/invites/:id');
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
   * POST /api/invites/:id/resend
   * Resend an invitation email
   * 
   * Generates a new magic link and sends it to the invited user.
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be admin of tenant
   */
  fastify.post(
    '/api/invites/:id/resend',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        // Only admins (or super admins) can resend invites
        if (user.role !== 'admin' && !user.is_super_admin) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admins can resend invites',
              details: {},
            },
          });
        }

        // Verify the invite belongs to this tenant
        const { data: invitedUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(id);

        if (fetchError || !invitedUser?.user) {
          return reply.code(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Invitation not found',
              details: {},
            },
          });
        }

        // Check tenant ownership and that user hasn't confirmed
        if (invitedUser.user.user_metadata?.tenant_id !== tenant.id) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'This invitation does not belong to your workspace',
              details: {},
            },
          });
        }

        if (invitedUser.user.email_confirmed_at) {
          return reply.code(400).send({
            error: {
              code: 'ALREADY_CONFIRMED',
              message: 'This user has already accepted the invitation',
              details: {},
            },
          });
        }

        const email = invitedUser.user.email;
        if (!email) {
          return reply.code(400).send({
            error: {
              code: 'NO_EMAIL',
              message: 'Invited user has no email address',
              details: {},
            },
          });
        }

        // Generate a new invite link
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: {
            tenant_id: tenant.id,
            tenant_subdomain: tenant.subdomain,
            tenant_name: tenant.name,
            role: invitedUser.user.user_metadata?.role || 'member',
            invited_by: user.id,
            invited_by_name: user.full_name || user.email,
          },
          redirectTo: `${process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim() || 'https://tynebase.vercel.app'}/auth/callback?tenant=${tenant.subdomain}`,
        });

        if (inviteError) {
          fastify.log.error({ error: inviteError, email, tenantId: tenant.id }, 'Failed to resend invite');
          return reply.code(500).send({
            error: {
              code: 'RESEND_FAILED',
              message: 'Failed to resend invitation email',
              details: {},
            },
          });
        }

        fastify.log.info(
          { inviteId: id, email, tenantId: tenant.id, resentBy: user.id },
          'Invitation resent'
        );

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'user.invite_resent',
          actionType: 'user',
          targetName: email,
          ipAddress: getClientIp(request),
          metadata: {},
        });

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Invitation resent successfully',
            email: email,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/invites/:id/resend');
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
}
