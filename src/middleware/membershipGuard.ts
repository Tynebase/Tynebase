import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Tenant Membership Guard Middleware
 *
 * Verifies that the authenticated user belongs to the tenant specified in the
 * request context.  Super admins bypass this check and can access any tenant.
 *
 * For multi-tenant users (composite PK), the auth middleware already resolves
 * `request.user.tenant_id` to match the subdomain-derived `request.tenant.id`.
 * This guard acts as a secondary safety net.
 *
 * Prerequisites:
 *   - Must be used AFTER authMiddleware (requires request.user)
 *   - Must be used AFTER tenantContextMiddleware (requires request.tenant)
 */
export async function membershipGuard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user;
  const tenant = request.tenant;

  if (!user) {
    request.log.error('membershipGuard called without user context');
    return reply.status(401).send({
      error: {
        code: 'MISSING_USER_CONTEXT',
        message: 'Authentication required',
      },
    });
  }

  if (!tenant) {
    request.log.error('membershipGuard called without tenant context');
    return reply.status(400).send({
      error: {
        code: 'MISSING_TENANT_CONTEXT',
        message: 'Tenant context required',
      },
    });
  }

  // Super admins can access any tenant
  if (user.is_super_admin) {
    request.log.info(
      {
        userId: user.id,
        tenantId: tenant.id,
        userTenantId: user.tenant_id,
      },
      'Super admin bypassing membership check'
    );
    return;
  }

  // The auth middleware already resolves the user for the correct tenant.
  // This check is a safety net: if the resolved user.tenant_id does not
  // match the request tenant, verify there is an actual DB membership row.
  if (user.tenant_id !== tenant.id) {
    // Double-check: maybe the user DOES have a row for this tenant but
    // the auth middleware resolved a different one (e.g. no subdomain).
    const { data: membership } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membership) {
      request.log.debug(
        { userId: user.id, tenantId: tenant.id },
        'Membership verified via DB lookup'
      );
      return;
    }

    request.log.warn(
      {
        userId: user.id,
        userTenantId: user.tenant_id,
        requestedTenantId: tenant.id,
        requestedSubdomain: tenant.subdomain,
      },
      'User attempted to access tenant they do not belong to'
    );
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have access to this tenant',
      },
    });
  }

  request.log.debug(
    {
      userId: user.id,
      tenantId: tenant.id,
    },
    'Membership verified'
  );
}
