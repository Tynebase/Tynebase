import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { superAdminGuard } from '../middleware/superAdminGuard';
import { supabaseAdmin } from '../lib/supabase';
import { z } from 'zod';

/**
 * Tenant List Item Interface
 */
interface TenantListItem {
  id: string;
  subdomain: string;
  name: string;
  tier: string;
  userCount: number;
  documentCount: number;
  creditsUsed: number;
  creditsTotal: number;
  lastActive: string | null;
  createdAt: string;
}

/**
 * Query Parameters Schema
 */
const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(100),
});

/**
 * Super Admin Tenant List Routes
 * 
 * Provides paginated list of all tenants with statistics
 */
export default async function superAdminTenantsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/superadmin/tenants
   * 
   * Returns paginated list of tenants with statistics:
   * - Subdomain, name, tier
   * - User count, document count
   * - Credits used/total
   * - Last active timestamp
   * 
   * Query Parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 100, max: 100)
   * 
   * Security: Super admin only
   */
  fastify.get(
    '/api/superadmin/tenants',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const queryParams = querySchema.parse(request.query);
        const { page, limit } = queryParams;
        const offset = (page - 1) * limit;

        // Query 1: Get all tenants with pagination
        const { data: tenants, error: tenantsError, count: totalCount } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (tenantsError) {
          const errorMessage = String(tenantsError.message || '');
          const errorCode = String(tenantsError.code || '');
          
          // Handle 416 Range Not Satisfiable (when pagination exceeds available data)
          // Supabase returns malformed JSON in error.message like: {\" when range exceeds data
          // This happens when offset >= total count
          const is416Error = 
            errorCode === 'PGRST103' || 
            errorCode === '416' ||
            errorMessage.includes('416') ||
            errorMessage.includes('Range Not Satisfiable') ||
            errorMessage === '{\"' ||
            (errorMessage.length < 10 && errorMessage.includes('{'));
          
          if (is416Error) {
            request.log.info(
              {
                userId: request.user?.id,
                page,
                limit,
                offset,
                totalCount,
              },
              'Requested page exceeds available data (416 Range Not Satisfiable)'
            );

            return {
              success: true,
              data: {
                tenants: [],
                pagination: {
                  page,
                  limit,
                  total: totalCount || 0,
                  totalPages: Math.ceil((totalCount || 0) / limit),
                },
              },
            };
          }

          request.log.error({ 
            error: tenantsError,
            errorMessage,
            errorCode,
            errorDetails: tenantsError.details,
            errorString: JSON.stringify(tenantsError),
          }, 'Failed to fetch tenants');
          throw tenantsError;
        }

        const totalPages = Math.ceil((totalCount || 0) / limit);

        if (!tenants || tenants.length === 0) {
          request.log.info(
            {
              userId: request.user?.id,
              page,
              limit,
              totalCount,
              returnedCount: 0,
            },
            'Tenant list retrieved (empty page)'
          );

          return {
            success: true,
            data: {
              tenants: [],
              pagination: {
                page,
                limit,
                total: totalCount || 0,
                totalPages,
              },
            },
          };
        }

        const tenantIds = tenants.map(t => t.id);

        // Query 2: Get user counts per tenant
        const { data: userCounts, error: userCountsError } = await supabaseAdmin
          .from('users')
          .select('tenant_id')
          .in('tenant_id', tenantIds)
          .neq('status', 'deleted');

        if (userCountsError) {
          request.log.error({ error: userCountsError }, 'Failed to count users');
          throw userCountsError;
        }

        const userCountMap = new Map<string, number>();
        userCounts?.forEach(u => {
          userCountMap.set(u.tenant_id, (userCountMap.get(u.tenant_id) || 0) + 1);
        });

        // Query 3: Get document counts per tenant
        const { data: documentCounts, error: documentCountsError } = await supabaseAdmin
          .from('documents')
          .select('tenant_id')
          .in('tenant_id', tenantIds);

        if (documentCountsError) {
          request.log.error({ error: documentCountsError }, 'Failed to count documents');
          throw documentCountsError;
        }

        const documentCountMap = new Map<string, number>();
        documentCounts?.forEach(d => {
          documentCountMap.set(d.tenant_id, (documentCountMap.get(d.tenant_id) || 0) + 1);
        });

        // Query 4: Get credit pool data per tenant
        const { data: creditPools, error: creditPoolsError } = await supabaseAdmin
          .from('credit_pools')
          .select('tenant_id, used_credits, total_credits')
          .in('tenant_id', tenantIds);

        if (creditPoolsError) {
          request.log.error({ error: creditPoolsError }, 'Failed to fetch credit pools');
          throw creditPoolsError;
        }

        const creditPoolMap = new Map<string, { used: number; total: number }>();
        creditPools?.forEach(cp => {
          creditPoolMap.set(cp.tenant_id, {
            used: cp.used_credits || 0,
            total: cp.total_credits || 0,
          });
        });

        // Query 5: Get last active timestamp per tenant (from users.last_active_at)
        const { data: lastActiveData, error: lastActiveError } = await supabaseAdmin
          .from('users')
          .select('tenant_id, last_active_at')
          .in('tenant_id', tenantIds)
          .not('last_active_at', 'is', null)
          .order('last_active_at', { ascending: false });

        if (lastActiveError) {
          request.log.error({ error: lastActiveError }, 'Failed to fetch last active timestamps');
          throw lastActiveError;
        }

        const lastActiveMap = new Map<string, string>();
        lastActiveData?.forEach(la => {
          if (!lastActiveMap.has(la.tenant_id)) {
            lastActiveMap.set(la.tenant_id, la.last_active_at);
          }
        });

        // Combine all data
        const tenantList: TenantListItem[] = tenants.map(tenant => {
          const credits = creditPoolMap.get(tenant.id) || { used: 0, total: 0 };
          
          return {
            id: tenant.id,
            subdomain: tenant.subdomain,
            name: tenant.name,
            tier: tenant.tier,
            userCount: userCountMap.get(tenant.id) || 0,
            documentCount: documentCountMap.get(tenant.id) || 0,
            creditsUsed: credits.used,
            creditsTotal: credits.total,
            lastActive: lastActiveMap.get(tenant.id) || null,
            createdAt: tenant.created_at,
          };
        });

        request.log.info(
          {
            userId: request.user?.id,
            page,
            limit,
            totalCount,
            returnedCount: tenantList.length,
          },
          'Tenant list retrieved'
        );

        return {
          success: true,
          data: {
            tenants: tenantList,
            pagination: {
              page,
              limit,
              total: totalCount || 0,
              totalPages,
            },
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'INVALID_QUERY_PARAMS',
              message: 'Invalid query parameters',
              details: error.errors,
            },
          });
        }

        request.log.error({ error }, 'Error retrieving tenant list');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve tenant list',
          },
        });
      }
    }
  );
}
