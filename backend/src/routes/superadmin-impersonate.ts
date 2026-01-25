import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { superAdminGuard } from '../middleware/superAdminGuard';
import { supabaseAdmin } from '../lib/supabase';
import { z } from 'zod';

/**
 * Tenant ID Parameter Schema
 */
const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

/**
 * Super Admin Impersonation Routes
 * 
 * Allows super admins to impersonate tenants for support and debugging
 */
export default async function superAdminImpersonateRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/superadmin/impersonate/:tenantId
   * 
   * Generates a short-lived JWT (1 hour) that allows the super admin
   * to access the tenant's data as if they were a user of that tenant.
   * 
   * The endpoint finds an admin user from the target tenant and generates
   * a token for that user. This allows the super admin to access all
   * tenant data through normal API endpoints.
   * 
   * Security:
   * - Super admin only
   * - Logs all impersonation events for audit trail
   * - Token expires in 1 hour
   * - Requires valid tenant ID
   */
  fastify.post(
    '/api/superadmin/impersonate/:tenantId',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const params = paramsSchema.parse(request.params);
        const { tenantId } = params;

        const superAdminId = request.user?.id;
        const superAdminEmail = request.user?.email;

        // Verify tenant exists
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier')
          .eq('id', tenantId)
          .single();

        if (tenantError || !tenant) {
          request.log.warn(
            {
              superAdminId,
              tenantId,
              error: tenantError,
            },
            'Tenant not found for impersonation'
          );
          return reply.status(404).send({
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Tenant not found',
            },
          });
        }

        // Find an admin user from the target tenant to impersonate
        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name, role, tenant_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('role', { ascending: true }) // Prefer admin role
          .limit(1)
          .single();

        if (userError || !targetUser) {
          request.log.warn(
            {
              superAdminId,
              tenantId,
              error: userError,
            },
            'No active users found in tenant for impersonation'
          );
          return reply.status(404).send({
            error: {
              code: 'NO_USERS_IN_TENANT',
              message: 'No active users found in this tenant',
            },
          });
        }

        // Generate a short-lived access token using Supabase Admin API
        // We use generateLink with type 'magiclink' to get an access token
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: targetUser.email,
          options: {
            redirectTo: '', // Not used for API access
          },
        });

        if (linkError || !linkData) {
          request.log.error(
            {
              superAdminId,
              tenantId,
              targetUserId: targetUser.id,
              error: linkError,
            },
            'Failed to generate impersonation token'
          );
          return reply.status(500).send({
            error: {
              code: 'TOKEN_GENERATION_FAILED',
              message: 'Failed to generate impersonation token',
            },
          });
        }

        // Extract the hashed_token which can be used to create a session
        const { hashed_token } = linkData.properties;

        if (!hashed_token) {
          request.log.error(
            {
              superAdminId,
              tenantId,
              targetUserId: targetUser.id,
            },
            'No hashed token in generated link'
          );
          return reply.status(500).send({
            error: {
              code: 'TOKEN_GENERATION_FAILED',
              message: 'Failed to generate impersonation token',
            },
          });
        }

        // Verify the token by exchanging it for a session
        const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
          token_hash: hashed_token,
          type: 'magiclink',
        });

        if (sessionError || !sessionData.session) {
          request.log.error(
            {
              superAdminId,
              tenantId,
              targetUserId: targetUser.id,
              error: sessionError,
            },
            'Failed to verify impersonation token'
          );
          return reply.status(500).send({
            error: {
              code: 'TOKEN_VERIFICATION_FAILED',
              message: 'Failed to verify impersonation token',
            },
          });
        }

        // Log the impersonation event for audit trail
        request.log.warn(
          {
            superAdminId,
            superAdminEmail,
            tenantId,
            tenantSubdomain: tenant.subdomain,
            targetUserId: targetUser.id,
            targetUserEmail: targetUser.email,
            expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          },
          'Super admin impersonation initiated'
        );

        // Return the access token with 1-hour expiry
        return {
          success: true,
          data: {
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
            expires_in: 3600, // 1 hour in seconds
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            tenant: {
              id: tenant.id,
              subdomain: tenant.subdomain,
              name: tenant.name,
              tier: tenant.tier,
            },
            impersonated_user: {
              id: targetUser.id,
              email: targetUser.email,
              full_name: targetUser.full_name,
              role: targetUser.role,
            },
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'INVALID_TENANT_ID',
              message: 'Invalid tenant ID format',
              details: error.errors,
            },
          });
        }

        request.log.error({ error }, 'Error during impersonation');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to impersonate tenant',
          },
        });
      }
    }
  );
}
