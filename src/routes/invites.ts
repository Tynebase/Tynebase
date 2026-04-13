import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { writeAuditLog, getClientIp } from '../lib/auditLog';
import { sendWorkspaceInviteEmail, sendEmail, emailTemplate } from '../services/email';
import { WORKSPACE_ROLE_INPUTS, canManageWorkspace, normalizeWorkspaceRole } from '../lib/roles';
import { notifyInvitation } from '../services/notifications';

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
  return `${frontendUrl}/auth/accept-invite?invite=${inviteId}&existing=1`;
}

async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const matchingUser = users.find((authUser) => authUser.email?.toLowerCase() === normalizedEmail);

    if (matchingUser) {
      return matchingUser;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function findAuthUserByIdOrEmail(userId: string | null | undefined, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  try {
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

      if (error) {
        throw error;
      }

      const users = data?.users || [];
      const matchingUser = users.find(
        (authUser) => (userId && authUser.id === userId) || authUser.email?.toLowerCase() === normalizedEmail
      );

      if (matchingUser) {
        return matchingUser;
      }

      if (users.length < perPage) {
        return null;
      }

      page += 1;
    }
  } catch (error) {
    console.error('Error in findAuthUserByIdOrEmail:', error);
    throw error;
  }
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
        // Community roles (community_contributor, community_admin) don't count toward the limit
        const userLimit = getUserLimitForTier(tenant.tier);
        const { count: currentUserCount } = await supabaseAdmin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .not('role', 'in', '("community_contributor", "community_admin")');

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
        let existingAuthUser = await findAuthUserByEmail(email);

        if (existingAuthUser && !existingAuthUser.email_confirmed_at) {
          const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);

          if (deleteAuthUserError) {
            fastify.log.warn(
              { error: deleteAuthUserError, email, authUserId: existingAuthUser.id },
              'Failed to delete stale unconfirmed auth user before sending invite'
            );
          } else {
            existingAuthUser = null;
          }
        }

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
            declineUrl: `${frontendUrl}/auth/invite-callback?invite_id=${inviteRecord.id}&action=decline`,
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
          fastify.log.info({ email, redirectTo, frontendUrl, inviteId: inviteRecord.id }, 'Generating invite link');

          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email,
            options: {
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
            },
          });

          if (linkError) {
            fastify.log.error({
              error: linkError,
              errorMessage: linkError.message,
              errorStatus: (linkError as any).status,
              errorCode: (linkError as any).code,
              email,
              tenantId: tenant.id,
              inviteId: inviteRecord.id,
            }, 'Failed to generate invite link');

            await supabaseAdmin.from('workspace_invites').delete().eq('id', inviteRecord.id);

            if (linkError.message?.includes('rate limit') || (linkError as any).status === 429) {
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
                message: 'Failed to create invitation. Please try again.',
                details: {},
              },
            });
          }

          if (linkData?.user?.id) {
            await supabaseAdmin
              .from('workspace_invites')
              .update({ auth_user_id: linkData.user.id })
              .eq('id', inviteRecord.id);
          }

          const inviteLink = linkData?.properties?.action_link;
          if (!inviteLink) {
            fastify.log.error({ email, inviteId: inviteRecord.id }, 'generateLink succeeded but action_link is missing');
            await supabaseAdmin.from('workspace_invites').delete().eq('id', inviteRecord.id);
            return reply.code(500).send({
              error: {
                code: 'INVITE_FAILED',
                message: 'Failed to create invitation. Please try again.',
                details: {},
              },
            });
          }

          const emailSent = await sendWorkspaceInviteEmail({
            to: email,
            tenantName: tenant.name,
            role,
            invitedBy: user.full_name || user.email,
            acceptUrl: inviteLink,
            declineUrl: `${frontendUrl}/auth/invite-callback?invite_id=${inviteRecord.id}&action=decline`,
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

        // Notify the invited user if they already have an account
        if (existingAuthUser?.id) {
          const { data: existingDbUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (existingDbUser) {
            notifyInvitation({
              userId: existingDbUser.id,
              tenantId: tenant.id,
              inviterName: user.full_name || user.email,
              workspaceName: tenant.name,
            }).catch(err => fastify.log.error({ err }, 'Failed to send invite notification'));
          }
        }

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

          // Community roles (community_contributor, community_admin) don't count toward the limit
          const userLimit = getUserLimitForTier(tenant.tier);
          const { count: currentUserCount } = await supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', inviteRecord.tenant_id)
            .eq('status', 'active')
            .not('role', 'in', '("community_contributor", "community_admin")');

          if ((currentUserCount || 0) >= userLimit) {
            return reply.code(403).send({
              error: {
                code: 'USER_LIMIT_REACHED',
                message: 'This workspace has reached its user limit. Please contact the workspace administrator to upgrade the plan.',
                details: { currentUsers: currentUserCount, limit: userLimit },
              },
            });
          }

          // IMPORTANT: `users` has a composite primary key (id, tenant_id).
          // One auth user can legitimately belong to multiple tenants, each
          // row independent. We must NEVER write with `.eq('id', authUser.id)`
          // alone — that rewrites every row the user owns and wipes
          // memberships (and previously corrupted `is_super_admin`).
          //
          // Correct approach: look up the row for THIS tenant only, then
          // either INSERT it fresh or UPDATE exactly that row via the
          // composite key. Any other memberships the user has in other
          // workspaces are left completely untouched.
          //
          // We also NEVER set `is_super_admin` from this path. It is a
          // platform-level flag owned by superadmin-only mutations; accepting
          // an invite must preserve whatever value the DB currently holds.

          const { data: existingRow, error: existingRowError } = await supabaseAdmin
            .from('users')
            .select('id, tenant_id, original_tenant_id, status, full_name, is_super_admin')
            .eq('id', authUser.id)
            .eq('tenant_id', inviteRecord.tenant_id)
            .maybeSingle();

          if (existingRowError) {
            fastify.log.error({ error: existingRowError, userId: authUser.id, tenantId: inviteRecord.tenant_id }, 'Failed to fetch existing user row during invite acceptance');
            return reply.code(500).send({
              error: {
                code: 'FETCH_FAILED',
                message: 'Failed to fetch user record',
                details: {},
              },
            });
          }

          // Derive original_tenant_id: only stamp it once, and only if the
          // user already has a different "home" tenant on another row.
          let originalTenantId: string | null = existingRow?.original_tenant_id ?? null;
          if (!originalTenantId) {
            const { data: otherRow } = await supabaseAdmin
              .from('users')
              .select('tenant_id')
              .eq('id', authUser.id)
              .neq('tenant_id', inviteRecord.tenant_id)
              .limit(1)
              .maybeSingle();
            if (otherRow?.tenant_id) {
              originalTenantId = otherRow.tenant_id;
            }
          }

          let joinedUser;

          if (existingRow) {
            // Scoped UPDATE — composite key ensures only this one row is touched.
            const { data: updatedUser, error: updateError } = await supabaseAdmin
              .from('users')
              .update({
                original_tenant_id: originalTenantId,
                email: authUser.email,
                full_name: fullName || existingRow.full_name,
                role: inviteRecord.role,
                status: 'active',
                // NOTE: `is_super_admin` intentionally omitted — preserved as-is.
                // NOTE: `tenant_id` intentionally omitted — it's part of the key.
              })
              .eq('id', authUser.id)
              .eq('tenant_id', inviteRecord.tenant_id)
              .select()
              .single();

            if (updateError || !updatedUser) {
              fastify.log.error({ error: updateError, userId: authUser.id, tenantId: inviteRecord.tenant_id }, 'Failed to update existing user row during invite acceptance');
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
            // Fresh membership row for this tenant. Any other rows the user
            // has in other tenants are completely untouched.
            const { data: createdUser, error: createError } = await supabaseAdmin
              .from('users')
              .insert({
                id: authUser.id,
                tenant_id: inviteRecord.tenant_id,
                original_tenant_id: originalTenantId,
                email: authUser.email,
                full_name: fullName,
                role: inviteRecord.role,
                status: 'active',
                // NOTE: `is_super_admin` intentionally omitted — uses DB default.
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

        // Composite PK `(id, tenant_id)` — only block if the user already
        // has a row for THIS specific tenant. Rows in other tenants are fine
        // and must not be disturbed.
        const { data: existingRowForTenant } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', user_id)
          .eq('tenant_id', tenant_id)
          .maybeSingle();

        if (existingRowForTenant) {
          return reply.code(400).send({
            error: {
              code: 'USER_EXISTS',
              message: 'User record already exists in this workspace',
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

        // Community roles (community_contributor, community_admin) don't count toward the limit
        const userLimit = getUserLimitForTier(tenant.tier);
        const { count: currentUserCount } = await supabaseAdmin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant_id)
          .eq('status', 'active')
          .not('role', 'in', '("community_contributor", "community_admin")');

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
      const { id } = request.params as { id: string };
      
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

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

        const relatedAuthUser = await findAuthUserByIdOrEmail(inviteRecord.auth_user_id, inviteRecord.email);

        if (relatedAuthUser && !relatedAuthUser.email_confirmed_at) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(relatedAuthUser.id);
          } catch (deleteError) {
            fastify.log.error({ error: deleteError, userId: relatedAuthUser.id }, 'Failed to delete unconfirmed user during invite cancellation');
            // Continue with invite cancellation even if user deletion fails
          }
        }

        const { error: cancelError } = await supabaseAdmin
          .from('workspace_invites')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', inviteRecord.id);

        if (cancelError) {
          fastify.log.error({ error: cancelError, inviteId: inviteRecord.id }, 'Failed to cancel invite in database');
          return reply.code(500).send({
            error: {
              code: 'CANCEL_FAILED',
              message: 'Failed to cancel invite',
              details: { databaseError: cancelError.message },
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
        fastify.log.error({ error, inviteId: id }, 'Unexpected error in DELETE /api/invites/:id');
        
        // Return more specific error information
        if (error instanceof Error) {
          return reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'An internal server error occurred',
              details: { 
                errorMessage: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
              },
            },
          });
        }
        
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
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
        let existingAuthUser = await findAuthUserByIdOrEmail(inviteRecord.auth_user_id, inviteRecord.email);

        if (existingAuthUser?.id && existingAuthUser.id !== inviteRecord.auth_user_id) {
          await supabaseAdmin
            .from('workspace_invites')
            .update({ auth_user_id: existingAuthUser.id })
            .eq('id', inviteRecord.id);
        }

        if (existingAuthUser && !existingAuthUser.email_confirmed_at) {
          const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);

          if (deleteAuthUserError) {
            fastify.log.warn(
              { error: deleteAuthUserError, inviteId: inviteRecord.id, authUserId: existingAuthUser.id },
              'Failed to delete stale unconfirmed auth user before resending invite'
            );
          } else {
            existingAuthUser = null;
            await supabaseAdmin
              .from('workspace_invites')
              .update({ auth_user_id: null })
              .eq('id', inviteRecord.id);
          }
        }

        if (existingAuthUser?.email_confirmed_at) {
          const emailSent = await sendWorkspaceInviteEmail({
            to: inviteRecord.email,
            tenantName: tenant.name,
            role: normalizeWorkspaceRole(inviteRecord.role as any),
            invitedBy: user.full_name || user.email,
            acceptUrl: buildExistingUserInviteUrl(frontendUrl, inviteRecord.id),
            declineUrl: `${frontendUrl}/auth/invite-callback?invite_id=${inviteRecord.id}&action=decline`,
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
          fastify.log.info({ email: inviteRecord.email, redirectTo, frontendUrl, inviteId: inviteRecord.id }, 'Generating invite link for resend');

          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email: inviteRecord.email,
            options: {
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
            },
          });

          if (linkError) {
            fastify.log.error({
              error: linkError,
              errorMessage: linkError.message,
              errorStatus: (linkError as any).status,
              errorCode: (linkError as any).code,
              email: inviteRecord.email,
              tenantId: tenant.id,
              inviteId: inviteRecord.id,
            }, 'Failed to generate invite link for resend');

            if (linkError.message?.includes('rate limit') || (linkError as any).status === 429) {
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
                message: 'Failed to resend invitation. Please try again.',
                details: {},
              },
            });
          }

          if (linkData?.user?.id) {
            await supabaseAdmin
              .from('workspace_invites')
              .update({ auth_user_id: linkData.user.id })
              .eq('id', inviteRecord.id);
          }

          const inviteLink = linkData?.properties?.action_link;
          if (!inviteLink) {
            fastify.log.error({ email: inviteRecord.email, inviteId: inviteRecord.id }, 'generateLink succeeded but action_link is missing for resend');
            return reply.code(500).send({
              error: {
                code: 'INVITE_FAILED',
                message: 'Failed to resend invitation. Please try again.',
                details: {},
              },
            });
          }

          const emailSent = await sendWorkspaceInviteEmail({
            to: inviteRecord.email,
            tenantName: tenant.name,
            role: normalizeWorkspaceRole(inviteRecord.role as any),
            invitedBy: user.full_name || user.email,
            acceptUrl: inviteLink,
            declineUrl: `${frontendUrl}/auth/invite-callback?invite_id=${inviteRecord.id}&action=decline`,
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

  fastify.post(
    '/api/invites/:id/decline',
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
          .select('id, email, tenant_id, status, invited_by')
          .eq('id', id)
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
          if (inviteRecord.status === 'declined') {
            return reply.code(200).send({
              success: true,
              data: {
                message: 'Invitation already declined',
              },
            });
          }
          return reply.code(400).send({
            error: {
              code: 'INVITE_NOT_PENDING',
              message: 'Only pending invites can be declined',
              details: {},
            },
          });
        }

        // Update invite status to declined
        const { error: declineError } = await supabaseAdmin
          .from('workspace_invites')
          .update({
            status: 'declined',
            declined_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (declineError) {
          fastify.log.error({ error: declineError, inviteId: id }, 'Failed to decline invite in database');
          return reply.code(500).send({
            error: {
              code: 'DECLINE_FAILED',
              message: 'Failed to decline invite',
              details: { databaseError: declineError.message },
            },
          });
        }

        // Get tenant details for email notification
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('name, subdomain')
          .eq('id', inviteRecord.tenant_id)
          .single();

        if (!tenantError && tenant) {
          // Send notification to the person who sent the invite
          let inviter = null;
          try {
            const { data } = await supabaseAdmin
              .from('users')
              .select('email, full_name')
              .eq('id', inviteRecord.invited_by)
              .single();
            inviter = data;

            if (inviter?.email) {
              await sendEmail({
                to: inviter.email,
                subject: `Invitation to ${inviteRecord.email} was declined`,
                html: emailTemplate(`
                  <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 600;">
                    Invitation Declined
                  </h2>
                  <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
                    Hi ${inviter.full_name || 'there'},
                  </p>
                  <p style="margin: 0 0 24px; color: #64748b; font-size: 15px; line-height: 1.6;">
                    <strong style="color: #1e293b;">${inviteRecord.email}</strong> has declined your invitation to join <strong style="color: #1e293b;">${tenant.name}</strong>.
                  </p>
                  <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                    You can send them a new invitation from the Users page if needed.
                  </p>
                `),
              });
            }
          } catch (emailError) {
            fastify.log.warn({ error: emailError, inviterEmail: inviter?.email }, 'Failed to send decline notification email');
          }
        }

        return reply.code(200).send({
          success: true,
          data: {
            message: 'Invitation declined successfully',
          },
        });
      } catch (error) {
        fastify.log.error({ error, inviteId: (request.params as any).id }, 'Unexpected error in POST /api/invites/:id/decline');
        
        if (error instanceof Error) {
          return reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'An internal server error occurred',
              details: { 
                errorMessage: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
              },
            },
          });
        }
        
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
            details: {},
          },
        });
      }
    }
  );
}
