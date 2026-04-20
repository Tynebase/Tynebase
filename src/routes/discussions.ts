import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { notifyNewComment } from '../services/notifications';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { writeAuditLog, getClientIp } from '../lib/auditLog';
import { canWriteContent } from '../lib/roles';

const createDiscussionSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  category: z.enum(['Announcements', 'Questions', 'Ideas', 'General']),
  tags: z.array(z.string().max(50)).max(10).optional(),
  is_public: z.boolean().optional(),
  poll: z.object({
    question: z.string().min(1).max(500),
    options: z.array(z.string().min(1).max(200)).min(2).max(10),
  }).optional(),
});

const createDraftDiscussionSchema = z.object({
  title: z.string().max(200).optional(),
  category: z.enum(['Announcements', 'Questions', 'Ideas', 'General']).optional(),
});

const updateDiscussionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  category: z.enum(['Announcements', 'Questions', 'Ideas', 'General']).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  is_public: z.boolean().optional(),
});

const createReplySchema = z.object({
  content: z.string().min(1).max(10000),
  parent_id: z.string().uuid().optional(),
});

const updateReplySchema = z.object({
  content: z.string().min(1).max(10000),
});

const voteOnPollSchema = z.object({
  optionId: z.string().uuid(),
});

function rejectReadOnlyUser(reply: any, message: string) {
  return reply.code(403).send({ error: { code: 'FORBIDDEN', message, details: {} } });
}

export default async function discussionsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/discussions - List discussions
   */
  fastify.get(
    '/api/discussions',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const query = request.query as { category?: string; page?: string; limit?: string; sortBy?: string };
        
        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
        const offset = (page - 1) * limit;
        const category = query.category;
        const sortBy = query.sortBy || 'recent';

        const tenant = (request as any).tenant;

        let discussionsQuery = supabaseAdmin
          .from('discussions')
          .select(`
            id, title, content, category, is_pinned, is_resolved, is_locked, is_public, tenant_id,
            replies_count, views_count, likes_count, tags, created_at, updated_at, author_id,
            author:users!discussions_author_id_fkey (id, email, full_name, avatar_url)
          `, { count: 'exact' });

        // Visibility filter: Public means whole tynebase community, Private means workspace only.
        discussionsQuery = discussionsQuery.or(`is_public.eq.true,tenant_id.eq.${tenant.id}`);

        if (category && category !== 'all') {
          discussionsQuery = discussionsQuery.eq('category', category);
        }

        // Sorting
        if (sortBy === 'popular') {
          discussionsQuery = discussionsQuery.order('is_pinned', { ascending: false }).order('likes_count', { ascending: false });
        } else if (sortBy === 'unanswered') {
          discussionsQuery = discussionsQuery.eq('is_resolved', false).order('is_pinned', { ascending: false }).order('replies_count', { ascending: true });
        } else {
          discussionsQuery = discussionsQuery.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
        }

        discussionsQuery = discussionsQuery.range(offset, offset + limit - 1);

        const { data: discussions, error, count } = await discussionsQuery;

        if (error) {
          fastify.log.error({ error }, 'Failed to fetch discussions');
          return reply.code(500).send({ error: { code: 'FETCH_FAILED', message: 'Failed to fetch discussions', details: {} } });
        }

        // Get polls for discussions
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
          discussions: discussionsWithPolls,
          pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/discussions');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions - Create discussion
   */
  fastify.post(
    '/api/discussions',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to create discussions');
        }
        const body = createDiscussionSchema.parse(request.body);

        const { data: discussion, error } = await supabaseAdmin
          .from('discussions')
          .insert({
            tenant_id: tenant.id,
            author_id: user.id,
            title: body.title,
            content: body.content,
            category: body.category,
            tags: body.tags || [],
            is_public: body.is_public ?? true,
          })
          .select(`
            id, title, content, category, is_pinned, is_resolved, is_locked, is_public,
            replies_count, views_count, likes_count, tags, created_at, updated_at,
            author:users!discussions_author_id_fkey (id, email, full_name, avatar_url)
          `)
          .single();

        if (error) {
          fastify.log.error({ error }, 'Failed to create discussion');
          return reply.code(500).send({ error: { code: 'CREATE_FAILED', message: 'Failed to create discussion', details: {} } });
        }

        // Create poll if provided
        let poll = null;
        if (body.poll) {
          const { data: pollData, error: pollError } = await supabaseAdmin
            .from('polls')
            .insert({ discussion_id: discussion.id, question: body.poll.question })
            .select()
            .single();

          if (!pollError && pollData) {
            const pollOptions = body.poll.options.map(text => ({ poll_id: pollData.id, text }));
            await supabaseAdmin.from('poll_options').insert(pollOptions);
            
            const { data: options } = await supabaseAdmin
              .from('poll_options')
              .select('id, text, votes_count')
              .eq('poll_id', pollData.id);

            poll = { ...pollData, options: options || [], total_votes: 0, has_voted: false };
          }
        }

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'discussion.created',
          actionType: 'document',
          targetName: body.title,
          ipAddress: getClientIp(request),
          metadata: { discussion_id: discussion.id },
        });

        return reply.code(201).send({ discussion: { ...discussion, poll } });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors } });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/draft - Create a draft discussion (for asset uploads before full submission)
   */
  fastify.post(
    '/api/discussions/draft',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to create draft discussions');
        }
        const body = createDraftDiscussionSchema.parse(request.body);

        const { data: discussion, error } = await supabaseAdmin
          .from('discussions')
          .insert({
            tenant_id: tenant.id,
            author_id: user.id,
            title: body.title || '',
            content: '',
            category: body.category || 'General',
            tags: [],
          })
          .select('id')
          .single();

        if (error) {
          fastify.log.error({ error }, 'Failed to create draft discussion');
          return reply.code(500).send({ error: { code: 'CREATE_FAILED', message: 'Failed to create draft discussion', details: {} } });
        }

        return reply.code(201).send({ discussion_id: discussion.id });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors } });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/draft');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * GET /api/discussions/:id - Get single discussion
   */
  fastify.get(
    '/api/discussions/:id',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        const { data: discussion, error } = await supabaseAdmin
          .from('discussions')
          .select(`
            id, title, content, category, is_pinned, is_resolved, is_locked, is_public, tenant_id,
            replies_count, views_count, likes_count, tags, created_at, updated_at, author_id,
            author:users!discussions_author_id_fkey (id, email, full_name, avatar_url)
          `)
          .eq('id', id)
          .single();

        if (error || !discussion) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        // Enforce visibility for private discussions
        if ((discussion as any).is_public === false && (discussion as any).tenant_id !== tenant.id) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        // Check if user has already viewed this discussion
        const { data: existingView } = await supabaseAdmin
          .from('discussion_views')
          .select('discussion_id')
          .eq('discussion_id', id)
          .eq('user_id', user.id)
          .single();

        // Record view and increment count only if first view
        if (!existingView) {
          await supabaseAdmin.from('discussion_views').insert({
            discussion_id: id,
            user_id: user.id,
          });
          // Increment views_count on the discussion
          await supabaseAdmin
            .from('discussions')
            .update({ views_count: discussion.views_count + 1 })
            .eq('id', id);
          discussion.views_count += 1;
        }

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

          const { data: userVote } = await supabaseAdmin
            .from('poll_votes')
            .select('option_id')
            .eq('poll_id', pollData.id)
            .eq('user_id', user.id)
            .single();

          const totalVotes = (options || []).reduce((sum, o) => sum + o.votes_count, 0);

          poll = {
            ...pollData,
            options: options || [],
            total_votes: totalVotes,
            has_voted: !!userVote,
            selected_option_id: userVote?.option_id,
          };
        }

        // Check if user liked
        const { data: userLike } = await supabaseAdmin
          .from('discussion_likes')
          .select('discussion_id')
          .eq('discussion_id', id)
          .eq('user_id', user.id)
          .single();

        return reply.code(200).send({
          discussion: { ...discussion, poll, has_liked: !!userLike },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/discussions/:id');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * PATCH /api/discussions/:id - Update discussion
   */
  fastify.patch(
    '/api/discussions/:id',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to edit discussions');
        }
        const body = updateDiscussionSchema.parse(request.body);

        const { data: existing } = await supabaseAdmin
          .from('discussions')
          .select('id, author_id')
          .eq('id', id)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        const isOwner = existing.author_id === user.id;
        const isSuperAdmin = user.is_super_admin === true;
        if (!isOwner && !isSuperAdmin) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not authorized to edit this discussion', details: {} } });
        }

        const { data: discussion, error } = await supabaseAdmin
          .from('discussions')
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return reply.code(500).send({ error: { code: 'UPDATE_FAILED', message: 'Failed to update discussion', details: {} } });
        }

        return reply.code(200).send({ discussion });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors } });
        }
        fastify.log.error({ error }, 'Unexpected error in PATCH /api/discussions/:id');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * DELETE /api/discussions/:id - Delete discussion
   */
  fastify.delete(
    '/api/discussions/:id',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to delete discussions');
        }

        const { data: existing } = await supabaseAdmin
          .from('discussions')
          .select('id, author_id, title')
          .eq('id', id)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        const isOwner = existing.author_id === user.id;
        const isSuperAdmin = user.is_super_admin === true;
        if (!isOwner && !isSuperAdmin) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this discussion', details: {} } });
        }

        const { error } = await supabaseAdmin.from('discussions').delete().eq('id', id);

        if (error) {
          return reply.code(500).send({ error: { code: 'DELETE_FAILED', message: 'Failed to delete discussion', details: {} } });
        }

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'discussion.deleted',
          actionType: 'document',
          targetName: existing.title,
          ipAddress: getClientIp(request),
          metadata: { discussion_id: id },
        });

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/discussions/:id');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/delete-beacon - Delete discussion via sendBeacon (for page unload)
   * This endpoint accepts POST with no body since sendBeacon sends POST requests
   */
  fastify.post(
    '/api/discussions/:id/delete-beacon',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return reply.code(200).send({ success: true });
        }

        const { data: existing } = await supabaseAdmin
          .from('discussions')
          .select('id, author_id, title')
          .eq('id', id)
          .single();

        if (!existing) {
          // Already deleted or doesn't exist - that's fine for beacon cleanup
          return reply.code(200).send({ success: true });
        }

        const isOwner = existing.author_id === user.id;
        const isSuperAdmin = user.is_super_admin === true;
        if (!isOwner && !isSuperAdmin) {
          // Not authorized - silently ignore for beacon
          return reply.code(200).send({ success: true });
        }

        await supabaseAdmin.from('discussions').delete().eq('id', id);

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'discussion.deleted',
          actionType: 'document',
          targetName: existing.title || 'Draft',
          ipAddress: getClientIp(request),
          metadata: { discussion_id: id, via: 'beacon' },
        });

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/delete-beacon');
        // Always return 200 for beacon - browser doesn't care about response
        return reply.code(200).send({ success: false });
      }
    }
  );

  /**
   * POST /api/discussions/:id/like - Toggle like
   */
  fastify.post(
    '/api/discussions/:id/like',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to like discussions');
        }

        const { data: existing } = await supabaseAdmin
          .from('discussions')
          .select('id')
          .eq('id', id)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        const { data: existingLike } = await supabaseAdmin
          .from('discussion_likes')
          .select('discussion_id')
          .eq('discussion_id', id)
          .eq('user_id', user.id)
          .single();

        if (existingLike) {
          await supabaseAdmin.from('discussion_likes').delete().eq('discussion_id', id).eq('user_id', user.id);
          return reply.code(200).send({ liked: false });
        } else {
          await supabaseAdmin.from('discussion_likes').insert({ discussion_id: id, user_id: user.id });
          return reply.code(200).send({ liked: true });
        }
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/like');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/pin - Toggle pin (admin/editor only)
   */
  fastify.post(
    '/api/discussions/:id/pin',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to pin discussions');
        }

        const { data: existing } = await supabaseAdmin
          .from('discussions')
          .select('id, is_pinned, author_id')
          .eq('id', id)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        const isOwner = existing.author_id === user.id;
        const isSuperAdmin = user.is_super_admin === true;
        if (!isOwner && !isSuperAdmin) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only the author can pin this discussion', details: {} } });
        }

        const { error } = await supabaseAdmin
          .from('discussions')
          .update({ is_pinned: !existing.is_pinned })
          .eq('id', id);

        if (error) {
          return reply.code(500).send({ error: { code: 'UPDATE_FAILED', message: 'Failed to update pin status', details: {} } });
        }

        return reply.code(200).send({ is_pinned: !existing.is_pinned });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/pin');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/lock - Toggle lock (admin/editor only)
   */
  fastify.post(
    '/api/discussions/:id/lock',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to lock discussions');
        }

        const { data: existing } = await supabaseAdmin
          .from('discussions')
          .select('id, is_locked, author_id')
          .eq('id', id)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        const isOwner = existing.author_id === user.id;
        const isSuperAdmin = user.is_super_admin === true;
        if (!isOwner && !isSuperAdmin) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only the author can lock this discussion', details: {} } });
        }

        const { error } = await supabaseAdmin
          .from('discussions')
          .update({ is_locked: !existing.is_locked })
          .eq('id', id);

        if (error) {
          return reply.code(500).send({ error: { code: 'UPDATE_FAILED', message: 'Failed to update lock status', details: {} } });
        }

        return reply.code(200).send({ is_locked: !existing.is_locked });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/lock');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/resolve - Toggle resolved
   */
  fastify.post(
    '/api/discussions/:id/resolve',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to resolve discussions');
        }

        const { data: existing } = await supabaseAdmin
          .from('discussions')
          .select('id, is_resolved, author_id')
          .eq('id', id)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        const isOwner = existing.author_id === user.id;
        const isSuperAdmin = user.is_super_admin === true;
        if (!isOwner && !isSuperAdmin) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only the author can resolve this discussion', details: {} } });
        }

        const { error } = await supabaseAdmin
          .from('discussions')
          .update({ is_resolved: !existing.is_resolved })
          .eq('id', id);

        if (error) {
          return reply.code(500).send({ error: { code: 'UPDATE_FAILED', message: 'Failed to update resolved status', details: {} } });
        }

        return reply.code(200).send({ is_resolved: !existing.is_resolved });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/resolve');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * GET /api/discussions/:id/replies - Get replies
   */
  fastify.get(
    '/api/discussions/:id/replies',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        const query = request.query as { page?: string; limit?: string };

        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
        const offset = (page - 1) * limit;

        const { data: discussion } = await supabaseAdmin
          .from('discussions')
          .select('id')
          .eq('id', id)
          .single();

        if (!discussion) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        const { data: replies, error, count } = await supabaseAdmin
          .from('discussion_replies')
          .select(`
            id, content, parent_id, is_accepted_answer, likes_count, created_at, updated_at,
            author:users!discussion_replies_author_id_fkey (id, email, full_name, avatar_url)
          `, { count: 'exact' })
          .eq('discussion_id', id)
          .order('created_at', { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) {
          return reply.code(500).send({ error: { code: 'FETCH_FAILED', message: 'Failed to fetch replies', details: {} } });
        }

        // Check which replies user has liked
        const replyIds = (replies || []).map(r => r.id);
        const { data: userLikes } = await supabaseAdmin
          .from('discussion_reply_likes')
          .select('reply_id')
          .in('reply_id', replyIds)
          .eq('user_id', user.id);

        const likedSet = new Set((userLikes || []).map(l => l.reply_id));
        const repliesWithLikeStatus = (replies || []).map(r => ({
          ...r,
          has_liked: likedSet.has(r.id),
        }));

        const total = count || 0;
        const totalPages = Math.ceil(total / limit);

        return reply.code(200).send({
          replies: repliesWithLikeStatus,
          pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/discussions/:id/replies');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/replies - Create reply
   */
  fastify.post(
    '/api/discussions/:id/replies',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to create replies');
        }
        const body = createReplySchema.parse(request.body);

        const { data: discussion } = await supabaseAdmin
          .from('discussions')
          .select('id, is_locked')
          .eq('id', id)
          .single();

        if (!discussion) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        if (discussion.is_locked) {
          return reply.code(403).send({ error: { code: 'LOCKED', message: 'This discussion is locked', details: {} } });
        }

        const { data: newReply, error } = await supabaseAdmin
          .from('discussion_replies')
          .insert({
            tenant_id: tenant.id,
            discussion_id: id,
            author_id: user.id,
            content: body.content,
            parent_id: body.parent_id || null,
          })
          .select(`
            id, content, parent_id, is_accepted_answer, likes_count, created_at, updated_at,
            author:users!discussion_replies_author_id_fkey (id, email, full_name, avatar_url)
          `)
          .single();

        if (error) {
          return reply.code(500).send({ error: { code: 'CREATE_FAILED', message: 'Failed to create reply', details: {} } });
        }

        // Notify the discussion author about the new reply (fire-and-forget)
        (async () => {
          try {
            const { data: disc } = await supabaseAdmin
              .from('discussions')
              .select('author_id, title')
              .eq('id', id)
              .single();

            if (disc && disc.author_id !== user.id) {
              await notifyNewComment({
                userId: disc.author_id,
                tenantId: tenant.id,
                commenterName: user.full_name || user.email,
                targetTitle: disc.title || 'a discussion',
                targetUrl: `/dashboard/community/${id}`,
              });
            }
          } catch (err) {
            fastify.log.error({ err }, 'Failed to send discussion reply notification');
          }
        })();

        return reply.code(201).send({ reply: { ...newReply, has_liked: false } });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors } });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/replies');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * PATCH /api/discussions/:id/replies/:rid - Update reply
   */
  fastify.patch(
    '/api/discussions/:id/replies/:rid',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { rid } = request.params as { id: string; rid: string };
        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to edit replies');
        }
        const body = updateReplySchema.parse(request.body);

        const { data: existing } = await supabaseAdmin
          .from('discussion_replies')
          .select('id, author_id')
          .eq('id', rid)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reply not found', details: {} } });
        }

        const isOwner = existing.author_id === user.id;
        const isSuperAdmin = user.is_super_admin === true;
        if (!isOwner && !isSuperAdmin) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not authorized to edit this reply', details: {} } });
        }

        const { data: updatedReply, error } = await supabaseAdmin
          .from('discussion_replies')
          .update({ content: body.content, updated_at: new Date().toISOString() })
          .eq('id', rid)
          .select()
          .single();

        if (error) {
          return reply.code(500).send({ error: { code: 'UPDATE_FAILED', message: 'Failed to update reply', details: {} } });
        }

        return reply.code(200).send({ reply: updatedReply });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors } });
        }
        fastify.log.error({ error }, 'Unexpected error in PATCH /api/discussions/:id/replies/:rid');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * DELETE /api/discussions/:id/replies/:rid - Delete reply
   */
  fastify.delete(
    '/api/discussions/:id/replies/:rid',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { rid } = request.params as { id: string; rid: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to delete replies');
        }

        const { data: existing } = await supabaseAdmin
          .from('discussion_replies')
          .select('id, author_id')
          .eq('id', rid)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reply not found', details: {} } });
        }

        const isOwner = existing.author_id === user.id;
        const isSuperAdmin = user.is_super_admin === true;
        if (!isOwner && !isSuperAdmin) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this reply', details: {} } });
        }

        const { error } = await supabaseAdmin.from('discussion_replies').delete().eq('id', rid);

        if (error) {
          return reply.code(500).send({ error: { code: 'DELETE_FAILED', message: 'Failed to delete reply', details: {} } });
        }

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/discussions/:id/replies/:rid');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/replies/:rid/like - Toggle reply like
   */
  fastify.post(
    '/api/discussions/:id/replies/:rid/like',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { rid } = request.params as { id: string; rid: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to like replies');
        }

        const { data: existing } = await supabaseAdmin
          .from('discussion_replies')
          .select('id')
          .eq('id', rid)
          .single();

        if (!existing) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reply not found', details: {} } });
        }

        const { data: existingLike } = await supabaseAdmin
          .from('discussion_reply_likes')
          .select('reply_id')
          .eq('reply_id', rid)
          .eq('user_id', user.id)
          .single();

        if (existingLike) {
          await supabaseAdmin.from('discussion_reply_likes').delete().eq('reply_id', rid).eq('user_id', user.id);
          return reply.code(200).send({ liked: false });
        } else {
          await supabaseAdmin.from('discussion_reply_likes').insert({ reply_id: rid, user_id: user.id });
          return reply.code(200).send({ liked: true });
        }
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/replies/:rid/like');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/replies/:rid/accept - Mark as accepted answer
   */
  fastify.post(
    '/api/discussions/:id/replies/:rid/accept',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id, rid } = request.params as { id: string; rid: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to accept answers');
        }

        const { data: discussion } = await supabaseAdmin
          .from('discussions')
          .select('id, author_id')
          .eq('id', id)
          .single();

        if (!discussion) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        if (discussion.author_id !== user.id && user.role !== 'admin' && !user.is_super_admin) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only the discussion author can accept answers', details: {} } });
        }

        const { data: replyData } = await supabaseAdmin
          .from('discussion_replies')
          .select('id, is_accepted_answer')
          .eq('id', rid)
          .eq('discussion_id', id)
          .single();

        if (!replyData) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Reply not found', details: {} } });
        }

        // Unaccept all other replies first
        await supabaseAdmin
          .from('discussion_replies')
          .update({ is_accepted_answer: false })
          .eq('discussion_id', id);

        // Toggle this reply
        const newStatus = !replyData.is_accepted_answer;
        await supabaseAdmin
          .from('discussion_replies')
          .update({ is_accepted_answer: newStatus })
          .eq('id', rid);

        // Mark discussion as resolved if accepting
        if (newStatus) {
          await supabaseAdmin.from('discussions').update({ is_resolved: true }).eq('id', id);
        }

        return reply.code(200).send({ is_accepted_answer: newStatus });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/replies/:rid/accept');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/poll/vote - Vote on poll
   */
  fastify.post(
    '/api/discussions/:id/poll/vote',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to vote in polls');
        }
        const body = voteOnPollSchema.parse(request.body);
        const { optionId } = body;

        const { data: discussion } = await supabaseAdmin
          .from('discussions')
          .select('id')
          .eq('id', id)
          .single();

        if (!discussion) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Discussion not found', details: {} } });
        }

        const { data: poll } = await supabaseAdmin
          .from('polls')
          .select('id, ends_at')
          .eq('discussion_id', id)
          .single();

        if (!poll) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Poll not found', details: {} } });
        }

        if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
          return reply.code(400).send({ error: { code: 'POLL_ENDED', message: 'This poll has ended', details: {} } });
        }

        // Validate optionId belongs to this poll
        const { data: validOption } = await supabaseAdmin
          .from('poll_options')
          .select('id')
          .eq('id', optionId)
          .eq('poll_id', poll.id)
          .single();

        if (!validOption) {
          return reply.code(400).send({ error: { code: 'INVALID_OPTION', message: 'Invalid poll option', details: {} } });
        }

        // Remove existing vote
        await supabaseAdmin.from('poll_votes').delete().eq('poll_id', poll.id).eq('user_id', user.id);

        // Add new vote
        await supabaseAdmin.from('poll_votes').insert({ poll_id: poll.id, user_id: user.id, option_id: optionId });

        // Get updated poll data
        const { data: options } = await supabaseAdmin
          .from('poll_options')
          .select('id, text, votes_count')
          .eq('poll_id', poll.id);

        const totalVotes = (options || []).reduce((sum, o) => sum + o.votes_count, 0);

        return reply.code(200).send({
          poll: {
            ...poll,
            options: options || [],
            total_votes: totalVotes,
            has_voted: true,
            selected_option_id: optionId,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors } });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/poll/vote');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );

  /**
   * POST /api/discussions/:id/poll/remove-vote - Remove poll vote
   */
  fastify.post(
    '/api/discussions/:id/poll/remove-vote',
    { preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard] },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        if (!canWriteContent(user.role, user.is_super_admin)) {
          return rejectReadOnlyUser(reply, 'Viewers do not have permission to remove poll votes');
        }

        const { data: poll } = await supabaseAdmin
          .from('polls')
          .select('id')
          .eq('discussion_id', id)
          .single();

        if (!poll) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Poll not found', details: {} } });
        }

        await supabaseAdmin.from('poll_votes').delete().eq('poll_id', poll.id).eq('user_id', user.id);

        const { data: options } = await supabaseAdmin
          .from('poll_options')
          .select('id, text, votes_count')
          .eq('poll_id', poll.id);

        const totalVotes = (options || []).reduce((sum, o) => sum + o.votes_count, 0);

        return reply.code(200).send({
          poll: {
            ...poll,
            options: options || [],
            total_votes: totalVotes,
            has_voted: false,
            selected_option_id: null,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in POST /api/discussions/:id/poll/remove-vote');
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} } });
      }
    }
  );
}
