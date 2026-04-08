import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Credit Guard Middleware
 * 
 * Protects AI endpoints by verifying tenant has sufficient credits.
 * Uses atomic query to check credit balance and prevent race conditions.
 * 
 * @param request - Fastify request object (requires request.tenant to be set)
 * @param reply - Fastify reply object
 */
export async function creditGuardMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const tenant = (request as any).tenant;

  if (!tenant || !tenant.id) {
    request.log.error('Credit guard called without tenant context');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Tenant context not available',
      },
    });
  }

  const tenantId = tenant.id;
  const currentMonth = new Date().toISOString().slice(0, 7);

  try {
    const { data, error } = await supabaseAdmin.rpc('get_credit_balance', {
      p_tenant_id: tenantId,
      p_month_year: currentMonth,
    });

    if (error) {
      request.log.error(
        {
          tenantId,
          error: error.message,
        },
        'Failed to check credit balance'
      );
      return reply.status(500).send({
        error: {
          code: 'CREDIT_CHECK_FAILED',
          message: 'Unable to verify credit balance',
        },
      });
    }

    if (!data || data.length === 0) {
      request.log.warn(
        {
          tenantId,
          month: currentMonth,
        },
        'No credit pool found for tenant'
      );
      return reply.status(403).send({
        error: {
          code: 'NO_CREDIT_POOL',
          message: 'No credit allocation found for this month. Please contact support.',
        },
      });
    }

    const balance = data[0];
    const availableCredits = balance.available_credits;

    if (availableCredits <= 0) {
      request.log.warn(
        {
          tenantId,
          totalCredits: balance.total_credits,
          usedCredits: balance.used_credits,
          availableCredits,
        },
        'Insufficient credits for AI operation'
      );
      return reply.status(403).send({
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: `You have no credits remaining. Used ${balance.used_credits} of ${balance.total_credits} credits this month.`,
          details: {
            total: balance.total_credits,
            used: balance.used_credits,
            available: availableCredits,
          },
        },
      });
    }

    request.log.debug(
      {
        tenantId,
        availableCredits,
        totalCredits: balance.total_credits,
        usedCredits: balance.used_credits,
      },
      'Credit check passed'
    );

    (request as any).creditBalance = {
      total: balance.total_credits,
      used: balance.used_credits,
      available: availableCredits,
    };
  } catch (err) {
    request.log.error(
      {
        tenantId,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      'Exception during credit check'
    );
    return reply.status(500).send({
      error: {
        code: 'CREDIT_CHECK_ERROR',
        message: 'An error occurred while checking credits',
      },
    });
  }
}
