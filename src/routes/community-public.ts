import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { authMiddleware } from '../middleware/auth';
import { canWriteContent } from '../lib/roles';

const voteOnPollSchema = z.object({
  optionId: z.string().uuid(),
});

export default async function communityPublicRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/public/community/:subdomain/categories
   * Returns categories with discussion counts for a tenant's public community.
   */
  fastify.get(
    '/api/public/community/:subdomain/categories',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { subdomain } = request.params as { subdomain: string };

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

        // Get all unique categories from discussions
        const { data: discussions, error } = await supabaseAdmin
          .from('discussions')
          .select('category')
          .eq('tenant_id', tenant.id);

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch categories');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch categories' },
          });
        }

        // Count discussions per category
        const categoryCounts = (discussions || []).reduce((acc, d) => {
          if (d.category) {
            acc[d.category] = (acc[d.category] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        // Standard community categories with metadata
        const standardCategories = [
          { id: 'Announcements', label: 'Announcements', icon: 'Bell', color: '#ef4444', description: 'Official updates and news' },
          { id: 'Questions', label: 'Questions', icon: 'HelpCircle', color: '#3b82f6', description: 'Get help from the community' },
          { id: 'Ideas', label: 'Ideas & Feedback', icon: 'TrendingUp', color: '#8b5cf6', description: 'Share suggestions and vote' },
          { id: 'General', label: 'General Discussion', icon: 'MessageSquare', color: '#10b981', description: 'Chat about anything' },
        ];

        // Merge with actual counts, include only categories that have discussions
        const categories = standardCategories
          .map(cat => ({
            ...cat,
            count: categoryCounts[cat.id] || 0,
          }))
          .filter(cat => cat.count > 0);

        return reply.code(200).send({
          success: true,
          data: { categories },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error in GET /api/public/community/:subdomain/categories');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );

  /**
   * GET /api/public/community/:subdomain/tags
   * Returns popular tags with discussion counts for a tenant's public community.
   */
  fastify.get(
    '/api/public/community/:subdomain/tags',
    { preHandler: [rateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { subdomain } = request.params as { subdomain: string };
        const query = request.query as { limit?: string };

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

        const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));

        // Get all tags from discussions
        const { data: discussions, error } = await supabaseAdmin
          .from('discussions')
          .select('tags')
          .eq('tenant_id', tenant.id)
          .not('tags', 'is', null);

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch tags');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch tags' },
          });
        }

        // Count occurrences of each tag
        const tagCounts = (discussions || []).reduce((acc, d) => {
          if (d.tags && Array.isArray(d.tags)) {
            d.tags.forEach(tag => {
              acc[tag] = (acc[tag] || 0) + 1;
            });
          }
          return acc;
        }, {} as Record<string, number>);

        // Convert to array and sort by count
        const tags = Object.entries(tagCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);

        return reply.code(200).send({
          success: true,
          data: { tags },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error in GET /api/public/community/:subdomain/tags');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );
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
        const sortBy = (query as any).sortBy || 'recent';

        let dbQuery = supabaseAdmin
          .from('discussions')
          .select(`
            id, title, content, category, is_pinned, is_resolved, is_locked,
            replies_count, views_count, likes_count, tags, created_at, updated_at,
            author:users!discussions_author_id_fkey (id, full_name, avatar_url)
          `, { count: 'exact' })
          .eq('tenant_id', tenant.id);

        if (query.category && query.category !== 'all') {
          dbQuery = dbQuery.eq('category', query.category);
        }

        if (sortBy === 'popular') {
          dbQuery = dbQuery.order('is_pinned', { ascending: false }).order('likes_count', { ascending: false });
        } else if (sortBy === 'unanswered') {
          dbQuery = dbQuery.eq('is_resolved', false).order('is_pinned', { ascending: false }).order('replies_count', { ascending: true });
        } else {
          dbQuery = dbQuery.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
        }

        dbQuery = dbQuery.range(offset, offset + limit - 1);

        const { data: discussions, error, count } = await dbQuery;

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch public discussions');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch discussions' },
          });
        }

        // Fetch polls for discussions
        const discussionIds = (discussions || []).map(d => d.id);
        const { data: polls } = await supabaseAdmin
          .from('polls')
          .select('id, discussion_id, question, ends_at, created_at')
          .in('discussion_id', discussionIds);

        const pollsMap = new Map((polls || []).map(p => [p.discussion_id, p]));

        const discussionsWithPolls = (discussions || []).map(d => ({
          ...d,
          poll: pollsMap.get(d.id) || null,
        }));

        const total = count || 0;
        const totalPages = Math.ceil(total / limit);

        return reply.code(200).send({
          success: true,
          data: {
            discussions: discussionsWithPolls,
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

        // Increment view count
        await supabaseAdmin
          .from('discussions')
          .update({ views_count: ((discussion as any).views_count || 0) + 1 })
          .eq('id', id);

        // Fetch replies
        const { data: replies } = await supabaseAdmin
          .from('discussion_replies')
          .select(`
            id, content, parent_id, is_accepted_answer, likes_count, created_at, updated_at,
            author:users!discussion_replies_author_id_fkey (id, full_name, avatar_url)
          `)
          .eq('discussion_id', id)
          .order('created_at', { ascending: true });

        // Get poll
        const { data: pollData } = await supabaseAdmin
          .from('polls')
          .select('id, question, ends_at, created_at')
          .eq('discussion_id', id)
          .single();

        let poll = null;
        if (pollData) {
          const { data: options } = await supabaseAdmin
            .from('poll_options')
            .select('id, text, votes_count')
            .eq('poll_id', pollData.id);

          const totalVotes = (options || []).reduce((sum, o) => sum + o.votes_count, 0);

          poll = {
            ...pollData,
            options: options || [],
            total_votes: totalVotes,
            has_voted: false,
            selected_option_id: null,
          };
        }

        return reply.code(200).send({
          success: true,
          data: {
            discussion: { ...discussion, poll },
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

  /**
   * POST /api/public/community/:subdomain/discussions/:id/like
   */
  fastify.post(
    '/api/public/community/:subdomain/discussions/:id/like',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as any).user;

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Read-only users cannot like' } });
        }

        const { data: existingLike } = await supabaseAdmin
          .from('discussion_likes')
          .select('discussion_id')
          .eq('discussion_id', id)
          .eq('user_id', user.id)
          .single();

        if (existingLike) {
          await supabaseAdmin.from('discussion_likes').delete().eq('discussion_id', id).eq('user_id', user.id);
          return reply.code(200).send({ success: true, liked: false });
        } else {
          await supabaseAdmin.from('discussion_likes').insert({ discussion_id: id, user_id: user.id });
          return reply.code(200).send({ success: true, liked: true });
        }
      } catch (error) {
        fastify.log.error({ error }, 'Error in POST /api/public/community/discussions/:id/like');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
      }
    }
  );

  /**
   * POST /api/public/community/:subdomain/discussions/:id/poll/vote
   */
  fastify.post(
    '/api/public/community/:subdomain/discussions/:id/poll/vote',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as any).user;
        const body = voteOnPollSchema.parse(request.body);

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Read-only users cannot vote' } });
        }

        const { data: poll } = await supabaseAdmin
          .from('polls')
          .select('id, ends_at')
          .eq('discussion_id', id)
          .single();

        if (!poll) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Poll not found' } });
        }

        if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
          return reply.code(400).send({ error: { code: 'POLL_ENDED', message: 'This poll has ended' } });
        }

        // Remove existing vote and add new one
        await supabaseAdmin.from('poll_votes').delete().eq('poll_id', poll.id).eq('user_id', user.id);
        await supabaseAdmin.from('poll_votes').insert({ poll_id: poll.id, user_id: user.id, option_id: body.optionId });

        // Get updated results
        const { data: options } = await supabaseAdmin
          .from('poll_options')
          .select('id, text, votes_count')
          .eq('poll_id', poll.id);

        return reply.code(200).send({
          success: true,
          poll: {
            ...poll,
            options: options || [],
            has_voted: true,
            selected_option_id: body.optionId,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error in POST /api/public/community/poll/vote');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
      }
    }
  );

  /**
   * POST /api/public/community/:subdomain/replies/:bid/like
   */
  fastify.post(
    '/api/public/community/:subdomain/replies/:bid/like',
    { preHandler: [rateLimitMiddleware, authMiddleware] },
    async (request, reply) => {
      try {
        const { bid: replyId } = request.params as { bid: string };
        const user = (request as any).user;

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Read-only users cannot like' } });
        }

        const { data: existingLike } = await supabaseAdmin
          .from('discussion_reply_likes')
          .select('reply_id')
          .eq('reply_id', replyId)
          .eq('user_id', user.id)
          .single();

        if (existingLike) {
          await supabaseAdmin.from('discussion_reply_likes').delete().eq('reply_id', replyId).eq('user_id', user.id);
          return reply.code(200).send({ success: true, liked: false });
        } else {
          await supabaseAdmin.from('discussion_reply_likes').insert({ reply_id: replyId, user_id: user.id });
          return reply.code(200).send({ success: true, liked: true });
        }
      } catch (error) {
        fastify.log.error({ error }, 'Error in POST /api/public/community/replies/:bid/like');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
      }
    }
  );
}
