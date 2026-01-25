import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { superAdminGuard } from '../middleware/superAdminGuard';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Platform Overview Statistics Interface
 */
interface PlatformOverview {
  totalTenants: number;
  totalUsers: number;
  totalDocuments: number;
  activeUsers: number;
  totalAIQueriesThisMonth: number;
  totalStorageUsed: number;
  activeWorkerCount: number;
}

/**
 * Super Admin Overview Routes
 * 
 * Provides aggregate platform statistics for super admin dashboard
 */
export default async function superAdminOverviewRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/superadmin/overview
   * 
   * Returns aggregate platform statistics:
   * - Total tenants, users, documents
   * - Active users (last 7 days)
   * - Total AI queries this month
   * - Total storage used
   * - Active worker count
   * 
   * Security: Super admin only
   */
  fastify.get(
    '/api/superadmin/overview',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Query 1: Total tenants
        const { count: totalTenants, error: tenantsError } = await supabaseAdmin
          .from('tenants')
          .select('*', { count: 'exact', head: true });

        if (tenantsError) {
          request.log.error({ error: tenantsError }, 'Failed to count tenants');
          throw tenantsError;
        }

        // Query 2: Total users
        const { count: totalUsers, error: usersError } = await supabaseAdmin
          .from('users')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'deleted');

        if (usersError) {
          request.log.error({ error: usersError }, 'Failed to count users');
          throw usersError;
        }

        // Query 3: Total documents
        const { count: totalDocuments, error: documentsError } = await supabaseAdmin
          .from('documents')
          .select('*', { count: 'exact', head: true });

        if (documentsError) {
          request.log.error({ error: documentsError }, 'Failed to count documents');
          throw documentsError;
        }

        // Query 4: Active users (last 7 days)
        const { count: activeUsers, error: activeUsersError } = await supabaseAdmin
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('last_active_at', sevenDaysAgo.toISOString())
          .neq('status', 'deleted');

        if (activeUsersError) {
          request.log.error({ error: activeUsersError }, 'Failed to count active users');
          throw activeUsersError;
        }

        // Query 5: Total AI queries this month
        const { data: queryData, error: queryError } = await supabaseAdmin
          .from('query_usage')
          .select('credits_charged')
          .gte('created_at', `${currentMonthYear}-01T00:00:00Z`)
          .lt('created_at', `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01T00:00:00Z`);

        if (queryError) {
          request.log.error({ error: queryError }, 'Failed to count AI queries');
          throw queryError;
        }

        const totalAIQueriesThisMonth = queryData?.length || 0;

        // Query 6: Total storage used (sum of all files in storage buckets)
        const { data: storageData, error: storageError } = await supabaseAdmin
          .from('objects')
          .select('metadata')
          .in('bucket_id', ['tenant-uploads', 'tenant-documents']);

        if (storageError) {
          request.log.error({ error: storageError }, 'Failed to calculate storage usage');
        }

        let totalStorageUsed = 0;
        if (storageData) {
          totalStorageUsed = storageData.reduce((sum, obj) => {
            const size = obj.metadata?.size || 0;
            return sum + size;
          }, 0);
        }

        // Query 7: Active worker count (from worker heartbeat or process count)
        // For now, we'll return 0 as worker tracking isn't implemented yet
        const activeWorkerCount = 0;

        const overview: PlatformOverview = {
          totalTenants: totalTenants || 0,
          totalUsers: totalUsers || 0,
          totalDocuments: totalDocuments || 0,
          activeUsers: activeUsers || 0,
          totalAIQueriesThisMonth,
          totalStorageUsed,
          activeWorkerCount,
        };

        request.log.info(
          {
            userId: request.user?.id,
            overview,
          },
          'Platform overview retrieved'
        );

        return {
          success: true,
          data: overview,
        };
      } catch (error) {
        request.log.error({ error }, 'Error retrieving platform overview');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve platform overview',
          },
        });
      }
    }
  );
}
