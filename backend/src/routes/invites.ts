import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { writeAuditLog, getClientIp } from '../lib/auditLog';
import { sendWorkspaceInviteEmail } from '../services/email';
import { WORKSPACE_ROLE_INPUTS, canManageWorkspace, normalizeWorkspaceRole } from '../lib/roles';

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
 * Build the redirect URL for a Supabase invite
 */
function buildSupabaseInviteRedirect(frontendUrl: string, tenantSubdomain: string, inviteId: string): string {
  return `${frontendUrl}/auth/invite-callback?tenant=${tenantSubdomain}&invite=${inviteId}`;
}

/**
 * Build the invite URL for an existing user
 */
function buildExistingUserInviteUrl(frontendUrl: string, inviteId: string): string {
  const redirect = encodeURIComponent(`/auth/accept-invite?invite=${inviteId}`);
  return `${frontendUrl}/login?redirect=${redirect}`;
}

/**
 * Zod schema for invite role
 */
const inviteRoleSchema = z.enum(WORKSPACE_ROLE_INPUTS).default('viewer').transform((role) => normalizeWorkspaceRole(role));
const legacyInviteRoleSchema = z.enum(WORKSPACE_ROLE_INPUTS).transform((role) => normalizeWorkspaceRole(role));

/**
 * Zod schema for POST /api/invites request body
 */
const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  role: inviteRoleSchema,
});

/**
 * Zod schema for POST /api/invites/accept request body
 */
const acceptInviteSchema = z.union([
  z.object({
    invite_id: z.string().uuid(),
    full_name: z.string().trim().max(100, 'Name must be 100 characters or less').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  }),
  z.object({
    user_id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    role: legacyInviteRoleSchema,
    full_name: z.string().trim().max(100, 'Name must be 100 characters or less').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  }),
]);

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
        if (!canManageWorkspace(user.role, user.is_super_admin)) {
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
        const { count: pendingInviteCount } = await supabaseAdmin
          .from('workspace_invites')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending');

        const totalUsers = (currentUserCount || 0) + (pendingInviteCount || 0);

        if (totalUsers >= userLimit) {
          return reply.code(403).send({
            error: {
              code: 'USER_LIMIT_REACHED',
              message: `Your ${tenant.tier} plan allows up to ${userLimit} user${userLimit === 1 ? '' : 's'}. Please upgrade to invite more team members.`,
              details: { currentUsers: currentUserCount, pendingInvites: pendingInviteCount || 0, limit: userLimit },
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

        if (existingUser && existingUser.status !== 'deleted') {
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

        const { data: existingPendingInvite } = await supabaseAdmin
          .from('workspace_invites')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('email', email)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingPendingInvite) {
          return reply.code(400).send({
            error: {
              code: 'INVITE_PENDING',
              message: 'An invitation has already been sent to this email. Use the Resend option to send another email.',
              details: {},
            },
          });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'https://www.tynebase.com';
        const { data: inviteRecord, error: inviteRecordError } = await supabaseAdmin
          .from('workspace_invites')
          .insert({
            tenant_id: tenant.id,
            email,
            role,
            invited_by: user.id,
            invited_by_name: user.full_name || user.email,
            auth_user_id: existingAuthUser?.id || null,
          })
          .select('id, email, role')
          .single();

        if (inviteRecordError || !inviteRecord) {
          fastify.log.error({ error: inviteRecordError, email, tenantId: tenant.id }, 'Failed to create workspace invite record');
          return reply.code(500).send({
            error: {
              code: 'INVITE_FAILED',
              message: 'Failed to create invitation record',
              details: {},
            },
          });
        }

        if (existingAuthUser?.email_confirmed_at) {
          const emailSent = await sendWorkspaceInviteEmail({
            to: email,
            tenantName: tenant.name,
            role,
            invitedBy: user.full_name || user.email,
            acceptUrl: buildExistingUserInviteUrl(frontendUrl, inviteRecord.id),
          });

          if (!emailSent) {
            await supabaseAdmin.from('workspace_invites').delete().eq('id', inviteRecord.id);
            return reply.code(500).send({
              error: {
                code: 'INVITE_FAILED',
                message: 'Failed to send invitation email',
                details: {},
              },
            });
          }
        } else {
          const redirectTo = buildSupabaseInviteRedirect(frontendUrl, tenant.subdomain, inviteRecord.id);
          fastify.log.info({ email, redirectTo, frontendUrl, inviteId: inviteRecord.id }, 'Sending invite with redirect URL');

          const { data: invitedAuthData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
              invite_id: inviteRecord.id,
              tenant_id: tenant.id,
              tenant_subdomain: tenant.subdomain,
              tenant_name: tenant.name,
              role,
              invited_by: user.id,
              invited_by_name: user.full_name || user.email,
            },
            redirectTo,
          });

          if (inviteError) {
            fastify.log.error({
              error: inviteError,
              errorMessage: inviteError.message,
              errorStatus: (inviteError as any).status,
              errorCode: (inviteError as any).code,
              email,
              tenantId: tenant.id,
              inviteId: inviteRecord.id,
            }, 'Failed to send invite');

            const errMsg = inviteError.message?.toLowerCase() || '';
            const isExistingAccountError =
              errMsg.includes('already registered') ||
              errMsg.includes('already been registered') ||
              errMsg.includes('user already exists') ||
              errMsg.includes('email address already');

            if (isExistingAccountError) {
              const emailSent = await sendWorkspaceInviteEmail({
                to: email,
                tenantName: tenant.name,
                role,
                invitedBy: user.full_name || user.email,
                acceptUrl: buildExistingUserInviteUrl(frontendUrl, inviteRecord.id),
              });

              if (!emailSent) {
                await supabaseAdmin.from('workspace_invites').delete().eq('id', inviteRecord.id);
                return reply.code(500).send({
                  error: {
                    code: 'INVITE_FAILED',
                    message: 'Failed to send invitation email',
                    details: {},
                  },
                });
              }
            } else {
              await supabaseAdmin.from('workspace_invites').delete().eq('id', inviteRecord.id);

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
          } else if (invitedAuthData?.user?.id) {
            await supabaseAdmin
              .from('workspace_invites')
              .update({ auth_user_id: invitedAuthData.user.id })
              .eq('id', inviteRecord.id);
          }
        }

        fastify.log.info(
          { email, role, tenantId: tenant.id, invitedBy: user.id, inviteId: inviteRecord.id },
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

  fastify.post(
    '/api/invites/accept',
    {
      preHandler: [rateLimitMiddleware],
    },
    async (request, reply) => {
      try {
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

        const body = acceptInviteSchema.parse(request.body);
        const fullName = body.full_name?.trim() || authUser.user_metadata?.full_name || authUser.user_metadata?.name || null;
        const password = body.password;

        if ('invite_id' in body) {
          const { data: inviteRecord, error: inviteError } = await supabaseAdmin
            .from('workspace_invites')
            .select('id, tenant_id, email, role, auth_user_id, status')
            .eq('id', body.invite_id)
            .single();

          if (inviteError || !inviteRecord || inviteRecord.status !== 'pending') {
            return reply.code(400).send({
              error: {
                code: 'INVALID_INVITE',
                message: 'This invitation is no longer valid',
                details: {},
              },
            });
          }

          const authEmail = authUser.email?.toLowerCase();
          if (!authEmail || authEmail !== inviteRecord.email.toLowerCase()) {
            return reply.code(403).send({
              error: {
                code: 'INVITE_EMAIL_MISMATCH',
                message: 'This invitation does not belong to the authenticated account',
                details: {},
              },
            });
          }

          if (inviteRecord.auth_user_id && inviteRecord.auth_user_id !== authUser.id) {
            return reply.code(403).send({
              error: {
                code: 'INVITE_USER_MISMATCH',
                message: 'This invitation belongs to a different user account',
                details: {},
              },
            });
          }

          const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('id, subdomain, name, tier')
            .eq('id', inviteRecord.tenant_id)
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

          const userLimit = getUserLimitForTier(tenant.tier);
          const { count: currentUserCount } = await supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', inviteRecord.tenant_id)
            .eq('status', 'active');

          if ((currentUserCount || 0) >= userLimit) {
            return reply.code(403).send({
              error: {
                code: 'USER_LIMIT_REACHED',
                message: 'This workspace has reached its user limit. Please contact the workspace administrator to upgrade the plan.',
                details: { currentUsers: currentUserCount, limit: userLimit },
              },
            });
          }

          const { data: existingUser, error: existingUserError } = await supabaseAdmin
            .from('users')
            .select('id, tenant_id, original_tenant_id, status, full_name')
            .eq('id', authUser.id)
            .maybeSingle();

          if (existingUserError) {
            fastify.log.error({ error: existingUserError, userId: authUser.id }, 'Failed to fetch existing user during invite acceptance');
            return reply.code(500).send({
              error: {
                code: 'FETCH_FAILED',
                message: 'Failed to fetch user record',
                details: {},
              },
            });
          }

          let joinedUser;

          if (existingUser) {
            const originalTenantId = existingUser.original_tenant_id || (existingUser.tenant_id !== inviteRecord.tenant_id ? existingUser.tenant_id : null);
            const { data: updatedUser, error: updateError } = await supabaseAdmin
              .from('users')
              .update({
                tenant_id: inviteRecord.tenant_id,
                original_tenant_id: originalTenantId,
                email: authUser.email,
                full_name: fullName || existingUser.full_name,
                role: inviteRecord.role,
                status: 'active',
              })
              .eq('id', authUser.id)
              .select()
              .single();

            if (updateError || !updatedUser) {
              fastify.log.error({ error: updateError, userId: authUser.id, tenantId: inviteRecord.tenant_id }, 'Failed to update existing user during invite acceptance');
              return reply.code(500).send({
                error: {
                  code: 'UPDATE_FAILED',
                  message: 'Failed to join workspace',
                  details: {},
                },
              });
            }

            joinedUser = updatedUser;
          } else {
            const { data: createdUser, error: createError } = await supabaseAdmin
              .from('users')
              .insert({
                id: authUser.id,
                tenant_id: inviteRecord.tenant_id,
                email: authUser.email,
                full_name: fullName,
                role: inviteRecord.role,
                status: 'active',
              })
              .select()
              .single();

            if (createError || !createdUser) {
              fastify.log.error({ error: createError, userId: authUser.id, tenantId: inviteRecord.tenant_id }, 'Failed to create user record during invite acceptance');
              return reply.code(500).send({
                error: {
                  code: 'CREATE_FAILED',
                  message: 'Failed to create user record',
                  details: {},
                },
              });
            }

            joinedUser = createdUser;
          }

          if (password) {
            const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
              password,
            });

            if (passwordError) {
              fastify.log.error({ error: passwordError, userId: authUser.id }, 'Failed to set password for invited user');
            }
          }

          await supabaseAdmin
            .from('user_consents')
            .upsert({
              user_id: authUser.id,
              ai_processing: true,
              analytics_tracking: true,
              knowledge_indexing: true,
            }, { onConflict: 'user_id' });

          await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
            user_metadata: {
              ...authUser.user_metadata,
              full_name: fullName,
              tenant_id: tenant.id,
              tenant_subdomain: tenant.subdomain,
              tenant_name: tenant.name,
              role: inviteRecord.role,
            },
          });

          await supabaseAdmin
            .from('workspace_invites')
            .update({
              status: 'accepted',
              accepted_at: new Date().toISOString(),
              accepted_by: authUser.id,
              auth_user_id: authUser.id,
            })
            .eq('id', inviteRecord.id);

          fastify.log.info(
            { userId: authUser.id, tenantId: inviteRecord.tenant_id, role: inviteRecord.role, inviteId: inviteRecord.id },
            'User accepted invite and joined tenant'
          );

          writeAuditLog({
            tenantId: inviteRecord.tenant_id,
            actorId: authUser.id,
            action: 'user.invite_accepted',
            actionType: 'user',
            targetName: authUser.email || null,
            ipAddress: getClientIp(request),
            metadata: { role: inviteRecord.role, invite_id: inviteRecord.id },
          });

          return reply.code(200).send({
            success: true,
            data: {
              message: 'Successfully joined the workspace',
              user: joinedUser,
              tenant: {
                id: tenant.id,
                subdomain: tenant.subdomain,
                name: tenant.name,
              },
            },
          });
        }

        const { user_id, tenant_id, role } = body;

        if (authUser.id !== user_id) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'User ID mismatch',
              details: {},
            },
          });
        }

        const metadataTenantId = authUser.user_metadata?.tenant_id;
        const metadataRole = normalizeWorkspaceRole(authUser.user_metadata?.role as any);

        if (!metadataTenantId || !authUser.user_metadata?.role) {
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
              message: 'This workspace has reached its user limit. Please contact the workspace administrator to upgrade the plan.',
              details: { currentUsers: currentUserCount, limit: userLimit },
            },
          });
        }

        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            id: user_id,
            tenant_id,
            email: authUser.email,
            full_name: fullName,
            role,
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

        if (password) {
          const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            password,
          });

          if (passwordError) {
            fastify.log.error({ error: passwordError, userId: user_id }, 'Failed to set password for invited user');
          }
        }

        await supabaseAdmin
          .from('user_consents')
          .upsert({
            user_id,
            ai_processing: true,
            analytics_tracking: true,
            knowledge_indexing: true,
          }, { onConflict: 'user_id' });

        fastify.log.info(
          { userId: user_id, tenantId: tenant_id, role },
          'User accepted legacy invite and joined tenant'
        );

        writeAuditLog({
          tenantId: tenant_id,
          actorId: user_id,
          action: 'user.invite_accepted',
          actionType: 'user',
          targetName: authUser.email || null,
          ipAddress: getClientIp(request),
          metadata: { role, flow: 'legacy' },
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

  fastify.get(
    '/api/invites/pending',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        if (!canManageWorkspace(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admins can view pending invites',
              details: {},
            },
          });
        }

        const { data: invites, error } = await supabaseAdmin
          .from('workspace_invites')
          .select('id, email, role, invited_by_name, created_at')
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) {
          fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch pending invites');
          return reply.code(500).send({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch pending invites',
              details: {},
            },
          });
        }

        const pendingInvites = (invites || []).map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: normalizeWorkspaceRole(invite.role as any),
          invited_by: invite.invited_by_name || 'Unknown',
          created_at: invite.created_at,
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

  fastify.get(
    '/api/invites/:id',
    {
      preHandler: [rateLimitMiddleware],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        if (!z.string().uuid().safeParse(id).success) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid invitation ID',
              details: {},
            },
          });
        }

        const { data: inviteRecord, error: inviteError } = await supabaseAdmin
          .from('workspace_invites')
          .select('id, tenant_id, email, role, invited_by_name, status, created_at')
          .eq('id', id)
          .single();

        if (inviteError || !inviteRecord || inviteRecord.status !== 'pending') {
          return reply.code(404).send({
            error: {
              code: 'INVITE_NOT_FOUND',
              message: 'Invitation not found',
              details: {},
            },
          });
        }

        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, name, subdomain')
          .eq('id', inviteRecord.tenant_id)
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

        return reply.code(200).send({
          success: true,
          data: {
            invite: {
              id: inviteRecord.id,
              email: inviteRecord.email,
              role: normalizeWorkspaceRole(inviteRecord.role as any),
              invited_by: inviteRecord.invited_by_name || 'A workspace admin',
              created_at: inviteRecord.created_at,
              tenant,
            },
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/invites/:id');
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

        if (!canManageWorkspace(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admins can cancel invites',
              details: {},
            },
          });
        }

        const { data: inviteRecord, error: inviteError } = await supabaseAdmin
          .from('workspace_invites')
          .select('id, email, auth_user_id, status')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (inviteError || !inviteRecord) {
          return reply.code(404).send({
            error: {
              code: 'INVITE_NOT_FOUND',
              message: 'Invitation not found',
              details: {},
            },
          });
        }

        if (inviteRecord.status !== 'pending') {
          return reply.code(400).send({
            error: {
              code: 'INVITE_NOT_PENDING',
              message: 'Only pending invites can be cancelled',
              details: {},
            },
          });
        }

        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const relatedAuthUser = authUsers?.users?.find((authUser) =>
          (inviteRecord.auth_user_id && authUser.id === inviteRecord.auth_user_id) ||
          authUser.email?.toLowerCase() === inviteRecord.email.toLowerCase()
        );

        if (relatedAuthUser && !relatedAuthUser.email_confirmed_at) {
          await supabaseAdmin.auth.admin.deleteUser(relatedAuthUser.id);
        }

        const { error: cancelError } = await supabaseAdmin
          .from('workspace_invites')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', inviteRecord.id);

        if (cancelError) {
          fastify.log.error({ error: cancelError, inviteId: inviteRecord.id }, 'Failed to cancel invite');
          return reply.code(500).send({
            error: {
              code: 'CANCEL_FAILED',
              message: 'Failed to cancel invite',
              details: {},
            },
          });
        }

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'user.invite_cancelled',
          actionType: 'user',
          targetName: inviteRecord.email,
          ipAddress: getClientIp(request),
          metadata: { invite_id: inviteRecord.id },
        });

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Invitation cancelled successfully',
            email: inviteRecord.email,
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

        if (!canManageWorkspace(user.role, user.is_super_admin)) {
          return reply.code(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Only admins can resend invites',
              details: {},
            },
          });
        }

        const { data: inviteRecord, error: inviteError } = await supabaseAdmin
          .from('workspace_invites')
          .select('id, email, role, auth_user_id, status')
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (inviteError || !inviteRecord) {
          return reply.code(404).send({
            error: {
              code: 'INVITE_NOT_FOUND',
              message: 'Invitation not found',
              details: {},
            },
          });
        }

        if (inviteRecord.status !== 'pending') {
          return reply.code(400).send({
            error: {
              code: 'INVITE_NOT_PENDING',
              message: 'Only pending invites can be resent',
              details: {},
            },
          });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'https://www.tynebase.com';
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = authUsers?.users?.find((authUser) =>
          (inviteRecord.auth_user_id && authUser.id === inviteRecord.auth_user_id) ||
          authUser.email?.toLowerCase() === inviteRecord.email.toLowerCase()
        );

        if (existingAuthUser?.id && existingAuthUser.id !== inviteRecord.auth_user_id) {
          await supabaseAdmin
            .from('workspace_invites')
            .update({ auth_user_id: existingAuthUser.id })
            .eq('id', inviteRecord.id);
        }

        if (existingAuthUser?.email_confirmed_at) {
          const emailSent = await sendWorkspaceInviteEmail({
            to: inviteRecord.email,
            tenantName: tenant.name,
            role: normalizeWorkspaceRole(inviteRecord.role as any),
            invitedBy: user.full_name || user.email,
            acceptUrl: buildExistingUserInviteUrl(frontendUrl, inviteRecord.id),
          });

          if (!emailSent) {
            return reply.code(500).send({
              error: {
                code: 'INVITE_FAILED',
                message: 'Failed to resend invitation email',
                details: {},
              },
            });
          }
        } else {
          const redirectTo = buildSupabaseInviteRedirect(frontendUrl, tenant.subdomain, inviteRecord.id);
          const { data: invitedAuthData, error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(inviteRecord.email, {
            data: {
              invite_id: inviteRecord.id,
              tenant_id: tenant.id,
              tenant_subdomain: tenant.subdomain,
              tenant_name: tenant.name,
              role: normalizeWorkspaceRole(inviteRecord.role as any),
              invited_by: user.id,
              invited_by_name: user.full_name || user.email,
            },
            redirectTo,
          });

          if (resendError) {
            const errMsg = resendError.message?.toLowerCase() || '';
            const isExistingAccountError =
              errMsg.includes('already registered') ||
              errMsg.includes('already been registered') ||
              errMsg.includes('user already exists') ||
              errMsg.includes('email address already');

            if (isExistingAccountError) {
              const emailSent = await sendWorkspaceInviteEmail({
                to: inviteRecord.email,
                tenantName: tenant.name,
                role: normalizeWorkspaceRole(inviteRecord.role as any),
                invitedBy: user.full_name || user.email,
                acceptUrl: buildExistingUserInviteUrl(frontendUrl, inviteRecord.id),
              });

              if (!emailSent) {
                return reply.code(500).send({
                  error: {
                    code: 'INVITE_FAILED',
                    message: 'Failed to resend invitation email',
                    details: {},
                  },
                });
              }
            } else if (resendError.message?.includes('rate limit') || (resendError as any).status === 429) {
              return reply.code(429).send({
                error: {
                  code: 'RATE_LIMITED',
                  message: 'Too many invite requests. Please wait a moment and try again.',
                  details: {},
                },
              });
            } else {
              return reply.code(500).send({
                error: {
                  code: 'INVITE_FAILED',
                  message: resendError.message || 'Failed to resend invitation email',
                  details: {},
                },
              });
            }
          } else if (invitedAuthData?.user?.id) {
            await supabaseAdmin
              .from('workspace_invites')
              .update({ auth_user_id: invitedAuthData.user.id })
              .eq('id', inviteRecord.id);
          }
        }

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'user.invite_resent',
          actionType: 'user',
          targetName: inviteRecord.email,
          ipAddress: getClientIp(request),
          metadata: { invite_id: inviteRecord.id },
        });

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Invitation resent successfully',
            email: inviteRecord.email,
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
