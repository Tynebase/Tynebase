import { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';

export default async function communityPublicRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/public/community/:subdomain/discussions
   * Returns list of discussions for a tenant's public community.
   */
  fastify.get(
    '/api/public/community/:subdomain/discussions',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { subdomain } = request.params as { subdomain: string };
        const query = request.query as { category?: string; page?: string; limit?: string };

        // Resolve tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('subdomain', subdomain.toLowerCase())
          .single();

        if (tenantError || !tenant) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Community not found' },
          });
        }

        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
        const offset = (page - 1) * limit;

        let dbQuery = supabaseAdmin
          .from('discussions')
          .select(`
            id, title, content, category, is_pinned, is_resolved, is_locked,
            replies_count, views_count, likes_count, tags, created_at, updated_at,
            author:users!discussions_author_id_fkey (id, full_name, avatar_url)
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });

        if (query.category && query.category !== 'all') {
          dbQuery = dbQuery.eq('category', query.category);
        }

        dbQuery = dbQuery.range(offset, offset + limit - 1);

        const { data: discussions, error, count } = await dbQuery;

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch public discussions');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch discussions' },
          });
        }

        const total = count || 0;
        const totalPages = Math.ceil(total / limit);

        return reply.code(200).send({
          success: true,
          data: {
            discussions: discussions || [],
            pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error in GET /api/public/community/:subdomain/discussions');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );

  /**
   * GET /api/public/community/:subdomain/discussions/:id
   * Returns a single discussion with replies.
   */
  fastify.get(
    '/api/public/community/:subdomain/discussions/:id',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { subdomain, id } = request.params as { subdomain: string; id: string };

        // Resolve tenant
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('subdomain', subdomain.toLowerCase())
          .single();

        if (!tenant) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Community not found' },
          });
        }

        const { data: discussion, error } = await supabaseAdmin
          .from('discussions')
          .select(`
            id, title, content, category, is_pinned, is_resolved, is_locked,
            replies_count, views_count, likes_count, tags, created_at, updated_at,
            author:users!discussions_author_id_fkey (id, full_name, avatar_url)
          `)
          .eq('id', id)
          .eq('tenant_id', tenant.id)
          .single();

        if (error || !discussion) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Discussion not found' },
          });
        }

        // Fetch replies
        const { data: replies } = await supabaseAdmin
          .from('discussion_replies')
          .select(`
            id, content, parent_id, is_accepted_answer, likes_count, created_at, updated_at,
            author:users!discussion_replies_author_id_fkey (id, full_name, avatar_url)
          `)
          .eq('discussion_id', id)
          .order('created_at', { ascending: true });

        return reply.code(200).send({
          success: true,
          data: {
            discussion,
            replies: replies || [],
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error in GET /api/public/community/:subdomain/discussions/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );
}
