import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';

/**
 * Zod schema for POST /api/invites request body
 */
const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'editor', 'member', 'viewer']).default('member'),
});

/**
 * Zod schema for POST /api/invites/accept request body
 */
const acceptInviteSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role: z.enum(['admin', 'editor', 'member', 'viewer']),
  full_name: z.string().optional(),
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

        // Only admins can invite users
        if (user.role !== 'admin') {
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

        // Check if user already exists in tenant
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id, email')
          .eq('email', email)
          .eq('tenant_id', tenant.id)
          .single();

        if (existingUser) {
          return reply.code(400).send({
            error: {
              code: 'USER_EXISTS',
              message: 'User with this email already exists in this workspace',
              details: {},
            },
          });
        }

        // Use Supabase's invite functionality
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
          redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?tenant=${tenant.subdomain}`,
        });

        if (inviteError) {
          fastify.log.error({ error: inviteError, email, tenantId: tenant.id }, 'Failed to send invite');
          
          // Handle specific Supabase errors
          if (inviteError.message?.includes('already registered')) {
            return reply.code(400).send({
              error: {
                code: 'EMAIL_EXISTS',
                message: 'This email is already registered. They can log in and join your workspace.',
                details: {},
              },
            });
          }

          return reply.code(500).send({
            error: {
              code: 'INVITE_FAILED',
              message: 'Failed to send invitation email',
              details: {},
            },
          });
        }

        fastify.log.info(
          { email, role, tenantId: tenant.id, invitedBy: user.id },
          'User invitation sent successfully'
        );

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

        // Verify tenant exists
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name')
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
}
