import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';
import { normalizeWorkspaceRole } from '../lib/roles';

/**
 * JWT Authentication Middleware
 * 
 * Verifies Supabase JWT token from Authorization header and populates request.user
 * 
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * 
 * Security:
 * - Verifies JWT signature using Supabase
 * - Checks token expiry automatically via Supabase SDK
 * - Validates issuer through Supabase configuration
 * - Queries database to get full user profile with tenant context
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({
      error: {
        code: 'MISSING_AUTH_TOKEN',
        message: 'Authorization header is required',
      },
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token || token === authHeader) {
    return reply.status(401).send({
      error: {
        code: 'INVALID_AUTH_FORMAT',
        message: 'Authorization header must be in format: Bearer <token>',
      },
    });
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user) {
      request.log.warn(
        { error: authError?.message },
        'JWT verification failed'
      );
      return reply.status(401).send({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        },
      });
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email;

    if (!userEmail) {
      request.log.error({ userId }, 'User email missing from JWT');
      return reply.status(401).send({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token payload',
        },
      });
    }

    // Check if tenant context is available (set by tenantContextMiddleware)
    const tenantContext = (request as any).tenant;
    let userData;
    let dbError;

    if (tenantContext && tenantContext.id) {
      // Query for user profile in the specific tenant context
      const { data: users, error: error } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, tenant_id, is_super_admin, status')
        .eq('id', userId)
        .eq('tenant_id', tenantContext.id)
        .maybeSingle();

      userData = users;
      dbError = error;
    } else {
      // No tenant context, fall back to first tenant (original behavior)
      const { data: users, error: error } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, tenant_id, is_super_admin, status')
        .eq('id', userId)
        .order('tenant_id', { ascending: true })
        .limit(1);

      userData = users?.[0];
      dbError = error;

      // If we found a user, populate tenant context for downstream middleware
      if (userData && userData.tenant_id) {
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, settings, storage_limit')
          .eq('id', userData.tenant_id)
          .single();

        if (!tenantError && tenant) {
          (request as any).tenant = {
            id: tenant.id,
            subdomain: tenant.subdomain,
            name: tenant.name,
            tier: tenant.tier,
            settings: tenant.settings || {},
            storage_limit: tenant.storage_limit,
          };
          request.log.info({ tenantId: tenant.id }, 'Tenant context populated from user profile');
        }
      }
    }

    if (dbError || !userData) {
      request.log.error(
        { userId, error: dbError },
        'User not found in database'
      );
      return reply.status(401).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found',
        },
      });
    }

    // Check if user is suspended
    if (userData.status === 'suspended') {
      request.log.warn(
        { userId, tenantId: userData.tenant_id },
        'Suspended user attempted to access API'
      );
      return reply.status(403).send({
        error: {
          code: 'USER_SUSPENDED',
          message: 'Your account has been suspended',
        },
      });
    }

    // Check if tenant is suspended (unless user is super admin)
    if (!userData.is_super_admin) {
      const { data: tenantData, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, status')
        .eq('id', userData.tenant_id)
        .single();

      if (tenantError || !tenantData) {
        request.log.error(
          { userId, tenantId: userData.tenant_id, error: tenantError },
          'Tenant not found for user'
        );
        return reply.status(403).send({
          error: {
            code: 'TENANT_NOT_FOUND',
            message: 'Your organization account not found',
          },
        });
      }

      if (tenantData.status === 'suspended') {
        request.log.warn(
          { userId, tenantId: userData.tenant_id },
          'User from suspended tenant attempted to access API'
        );
        return reply.status(403).send({
          error: {
            code: 'TENANT_SUSPENDED',
            message: 'Your organization has been suspended. Please contact support.',
          },
        });
      }
    }

    const normalizedRole = normalizeWorkspaceRole(userData.role as any);

    (request as any).user = {
      id: userData.id,
      email: userData.email,
      full_name: userData.full_name,
      role: normalizedRole,
      tenant_id: userData.tenant_id,
      is_super_admin: userData.is_super_admin || false,
    };

    request.log.info(
      {
        userId: userData.id,
        tenantId: userData.tenant_id,
        role: normalizedRole,
      },
      'User authenticated successfully'
    );
  } catch (error) {
    request.log.error({ error }, 'Authentication error');
    return reply.status(500).send({
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}
