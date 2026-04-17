import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { notifyDirectMessage } from '../services/notifications';

/**
 * Zod schemas for DM API
 */
const startConversationSchema = z.object({
  user_id: z.string().uuid(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

/**
 * Direct Messages routes
 */
export default async function dmRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/dm/conversations
   * List all DM conversations for the current user
   */
  fastify.get(
    '/api/dm/conversations',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Get conversations the user is part of
        const { data: participations, error: partError } = await supabaseAdmin
          .from('dm_participants')
          .select('conversation_id, last_read_at, is_muted')
          .eq('user_id', user.id);

        if (partError) {
          fastify.log.error({ error: partError }, 'Failed to fetch DM participations');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch conversations', details: {} },
          });
        }

        if (!participations || participations.length === 0) {
          return reply.code(200).send({
            success: true,
            data: { conversations: [] },
          });
        }

        const conversationIds = participations.map(p => p.conversation_id);

        // Get conversation details
        const { data: conversations, error: convError } = await supabaseAdmin
          .from('dm_conversations')
          .select('id, name, is_group, created_by, created_at, updated_at')
          .in('id', conversationIds)
          .eq('tenant_id', tenant.id)
          .order('updated_at', { ascending: false });

        if (convError) {
          fastify.log.error({ error: convError }, 'Failed to fetch DM conversations');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch conversations', details: {} },
          });
        }

        // Get participants for each conversation.
        // NOTE: dm_participants_user_id_fkey is a simple FK referencing users(id),
        // but after the composite PK migration users has (id, tenant_id) as PK so
        // PostgREST join hints are unreliable. Fetch user_ids directly and look them up.
        const { data: allParticipantRows, error: participantsError } = await supabaseAdmin
          .from('dm_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', conversationIds);

        if (participantsError) {
          fastify.log.error({ error: participantsError, conversationIds }, 'Failed to fetch DM participants');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch participants', details: {} },
          });
        }

        // Resolve participant user info
        const participantUserIds = [...new Set((allParticipantRows || []).map((p: any) => p.user_id).filter(Boolean))];
        const { data: participantUsers } = participantUserIds.length > 0
          ? await supabaseAdmin
              .from('users')
              .select('id, full_name, email, avatar_url')
              .eq('tenant_id', tenant.id)
              .in('id', participantUserIds)
          : { data: [] };
        const participantUsersMap: Record<string, any> = {};
        (participantUsers || []).forEach((u: any) => { participantUsersMap[u.id] = u; });

        // Get unread counts
        const participationMap = new Map(
          participations.map(p => [p.conversation_id, p])
        );

        // Get last message for each conversation
        const { data: lastMessages, error: lastMessagesError } = await supabaseAdmin
          .from('dm_messages')
          .select('conversation_id, content, created_at, author_id')
          .in('conversation_id', conversationIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (lastMessagesError) {
          fastify.log.error({ error: lastMessagesError, conversationIds }, 'Failed to fetch last messages');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch messages', details: {} },
          });
        }

        // Group last messages by conversation (take first one per conversation)
        const lastMessageMap = new Map<string, any>();
        (lastMessages || []).forEach(msg => {
          if (!lastMessageMap.has(msg.conversation_id)) {
            lastMessageMap.set(msg.conversation_id, msg);
          }
        });

        // Get unread counts for each conversation
        const conversationsWithDetails = await Promise.all(
          (conversations || []).map(async (conv) => {
            const participation = participationMap.get(conv.id);
            const lastReadAt = participation?.last_read_at;

            // Count unread messages
            let unreadCount = 0;
            if (lastReadAt) {
              try {
                const { count } = await supabaseAdmin
                  .from('dm_messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('conversation_id', conv.id)
                  .is('deleted_at', null)
                  .gt('created_at', lastReadAt)
                  .neq('author_id', user.id);
                unreadCount = count || 0;
              } catch (unreadError) {
                fastify.log.error({ error: unreadError, conversationId: conv.id }, 'Failed to count unread messages');
                unreadCount = 0;
              }
            }

            // Get participants for this conversation
            const participants = (allParticipantRows || [])
              .filter((p: any) => p.conversation_id === conv.id)
              .map((p: any) => participantUsersMap[p.user_id])
              .filter(Boolean);

            // Get the other user for 1:1 conversations
            const otherParticipant = participants.find((p: any) => p.id !== user.id);

            return {
              ...conv,
              participants,
              other_user: conv.is_group ? null : otherParticipant,
              last_message: lastMessageMap.get(conv.id) || null,
              unread_count: unreadCount,
              is_muted: participation?.is_muted || false,
            };
          })
        );

        return reply.code(200).send({
          success: true,
          data: { conversations: conversationsWithDetails },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        fastify.log.error({ error: errorMessage, stack: errorStack }, 'Unexpected error in GET /api/dm/conversations');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: { message: errorMessage } },
        });
      }
    }
  );

  /**
   * POST /api/dm/conversations
   * Start a new DM conversation with a user (or get existing one)
   */
  fastify.post(
    '/api/dm/conversations',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const body = startConversationSchema.parse(request.body);

        // Can't DM yourself
        if (body.user_id === user.id) {
          return reply.code(400).send({
            error: { code: 'INVALID_USER', message: 'Cannot start a conversation with yourself', details: {} },
          });
        }

        // Verify target user exists and is in the same tenant
        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('users')
          .select('id, full_name, email, avatar_url')
          .eq('id', body.user_id)
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .single();

        if (userError || !targetUser) {
          return reply.code(404).send({
            error: { code: 'USER_NOT_FOUND', message: 'User not found', details: {} },
          });
        }

        // Use the database function to find or create conversation
        const { data: conversationId, error: rpcError } = await supabaseAdmin
          .rpc('find_or_create_dm_conversation', {
            p_tenant_id: tenant.id,
            p_user1_id: user.id,
            p_user2_id: body.user_id,
          });

        if (rpcError) {
          fastify.log.error({ error: rpcError }, 'Failed to find/create DM conversation');
          return reply.code(500).send({
            error: { code: 'CREATE_FAILED', message: 'Failed to create conversation', details: {} },
          });
        }

        // Fetch the conversation with details
        const { data: conversation, error: convError } = await supabaseAdmin
          .from('dm_conversations')
          .select('id, name, is_group, created_by, created_at, updated_at')
          .eq('id', conversationId)
          .single();

        if (convError || !conversation) {
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch conversation', details: {} },
          });
        }

        // Get current user info
        const { data: currentUser } = await supabaseAdmin
          .from('users')
          .select('id, full_name, email, avatar_url')
          .eq('id', user.id)
          .single();

        return reply.code(200).send({
          success: true,
          data: {
            conversation: {
              ...conversation,
              participants: [currentUser, targetUser],
              other_user: targetUser,
              last_message: null,
              unread_count: 0,
              is_muted: false,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/dm/conversations');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * GET /api/dm/conversations/:id/messages
   * Get messages for a DM conversation
   */
  fastify.get(
    '/api/dm/conversations/:id/messages',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        const query = request.query as { limit?: string; before?: string };

        const limit = Math.min(parseInt(query.limit || '50', 10), 100);
        const before = query.before;

        // Verify user is a participant
        const { data: participation, error: partError } = await supabaseAdmin
          .from('dm_participants')
          .select('conversation_id')
          .eq('conversation_id', id)
          .eq('user_id', user.id)
          .single();

        if (partError || !participation) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'You are not a participant in this conversation', details: {} },
          });
        }

        // Build query — no FK join (composite PK on users breaks them)
        let messagesQuery = supabaseAdmin
          .from('dm_messages')
          .select(`
            id,
            content,
            author_id,
            edited_at,
            deleted_at,
            created_at
          `)
          .eq('conversation_id', id)
          .is('deleted_at', null);

        if (before) {
          messagesQuery = messagesQuery.lt('created_at', before);
        }

        messagesQuery = messagesQuery
          .order('created_at', { ascending: false })
          .limit(limit);

        const { data: messages, error } = await messagesQuery;

        if (error) {
          fastify.log.error({ error, conversationId: id }, 'Failed to fetch DM messages');
          return reply.code(500).send({
            error: { code: 'FETCH_FAILED', message: 'Failed to fetch messages', details: {} },
          });
        }

        // Resolve author info via tenant-scoped lookup
        const dmAuthorIds = [...new Set((messages || []).map((m: any) => m.author_id).filter(Boolean))];
        const { data: dmAuthorRows } = dmAuthorIds.length > 0
          ? await supabaseAdmin
              .from('users')
              .select('id, full_name, email, avatar_url')
              .eq('tenant_id', (request as any).tenant.id)
              .in('id', dmAuthorIds)
          : { data: [] };
        const dmAuthorMap: Record<string, any> = {};
        (dmAuthorRows || []).forEach((u: any) => { dmAuthorMap[u.id] = u; });

        // Get reactions for these messages
        const messageIds = (messages || []).map((m: any) => m.id);
        const { data: reactions } = await supabaseAdmin
          .from('dm_reactions')
          .select(`
            id,
            message_id,
            emoji,
            user_id
          `)
          .in('message_id', messageIds);

        // Resolve reaction user names
        const dmReactionUserIds = [...new Set((reactions || []).map((r: any) => r.user_id).filter(Boolean))];
        const { data: dmReactionUserRows } = dmReactionUserIds.length > 0
          ? await supabaseAdmin
              .from('users')
              .select('id, full_name')
              .eq('tenant_id', (request as any).tenant.id)
              .in('id', dmReactionUserIds)
          : { data: [] };
        const dmReactionUserMap: Record<string, any> = {};
        (dmReactionUserRows || []).forEach((u: any) => { dmReactionUserMap[u.id] = u; });

        // Group reactions by message
        const reactionsMap: Record<string, any[]> = {};
        (reactions || []).forEach((r: any) => {
          if (!reactionsMap[r.message_id]) {
            reactionsMap[r.message_id] = [];
          }
          reactionsMap[r.message_id].push({
            ...r,
            user: dmReactionUserMap[r.user_id] || null,
          });
        });

        // Attach author + reactions to messages
        const messagesWithReactions = (messages || []).map((m: any) => ({
          ...m,
          author: dmAuthorMap[m.author_id] || null,
          reactions: reactionsMap[m.id] || [],
        }));

        // Reverse to get chronological order
        messagesWithReactions.reverse();

        return reply.code(200).send({
          success: true,
          data: {
            messages: messagesWithReactions,
            has_more: messages?.length === limit,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in GET /api/dm/conversations/:id/messages');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * POST /api/dm/conversations/:id/messages
   * Send a message to a DM conversation
   */
  fastify.post(
    '/api/dm/conversations/:id/messages',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        const body = sendMessageSchema.parse(request.body);

        // Verify user is a participant
        const { data: participation, error: partError } = await supabaseAdmin
          .from('dm_participants')
          .select('conversation_id')
          .eq('conversation_id', id)
          .eq('user_id', user.id)
          .single();

        if (partError || !participation) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'You are not a participant in this conversation', details: {} },
          });
        }

        // Insert message
        const { data: message, error } = await supabaseAdmin
          .from('dm_messages')
          .insert({
            tenant_id: tenant.id,
            conversation_id: id,
            author_id: user.id,
            content: body.content,
          })
          .select('id, content, edited_at, deleted_at, created_at, author_id')
          .single();

        if (error) {
          fastify.log.error({ error, conversationId: id }, 'Failed to send DM message');
          return reply.code(500).send({
            error: { code: 'SEND_FAILED', message: 'Failed to send message', details: {} },
          });
        }

        // Build author from authenticated user info
        const dmSendAuthor = {
          id: user.id,
          full_name: user.full_name || null,
          email: user.email || null,
          avatar_url: user.avatar_url || null,
        };

        // Notify other participants about the new DM (fire-and-forget)
        (async () => {
          try {
            const { data: participants } = await supabaseAdmin
              .from('dm_participants')
              .select('user_id')
              .eq('conversation_id', id)
              .neq('user_id', user.id);

            if (participants?.length) {
              const preview = body.content.length > 100 ? body.content.substring(0, 100) + '...' : body.content;
              for (const p of participants) {
                notifyDirectMessage({
                  userId: p.user_id,
                  tenantId: tenant.id,
                  senderName: user.full_name || user.email,
                  messagePreview: preview,
                  conversationId: id,
                }).catch(() => {});
              }
            }
          } catch (err) {
            fastify.log.error({ err }, 'Failed to send DM notifications');
          }
        })();

        return reply.code(201).send({
          success: true,
          data: {
            message: {
              ...message,
              author: dmSendAuthor,
              reactions: [],
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/dm/conversations/:id/messages');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * PATCH /api/dm/messages/:id
   * Edit a DM message (own only)
   */
  fastify.patch(
    '/api/dm/messages/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        const body = editMessageSchema.parse(request.body);

        // Verify message exists and belongs to user
        const { data: existingMessage, error: fetchError } = await supabaseAdmin
          .from('dm_messages')
          .select('id, author_id')
          .eq('id', id)
          .single();

        if (fetchError || !existingMessage) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Message not found', details: {} },
          });
        }

        if (existingMessage.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'You can only edit your own messages', details: {} },
          });
        }

        const { data: message, error } = await supabaseAdmin
          .from('dm_messages')
          .update({
            content: body.content,
            edited_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('id, content, author_id, edited_at, deleted_at, created_at')
          .single();

        if (error) {
          fastify.log.error({ error, messageId: id }, 'Failed to edit DM message');
          return reply.code(500).send({
            error: { code: 'EDIT_FAILED', message: 'Failed to edit message', details: {} },
          });
        }

        // Attach author from authenticated user
        const editedDMWithAuthor = {
          ...message,
          author: {
            id: user.id,
            full_name: user.full_name || null,
            email: user.email || null,
            avatar_url: user.avatar_url || null,
          },
        };

        return reply.code(200).send({
          success: true,
          data: { message: editedDMWithAuthor },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in PATCH /api/dm/messages/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * DELETE /api/dm/messages/:id
   * Soft delete a DM message (own only)
   */
  fastify.delete(
    '/api/dm/messages/:id',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        // Verify message exists and belongs to user
        const { data: existingMessage, error: fetchError } = await supabaseAdmin
          .from('dm_messages')
          .select('id, author_id')
          .eq('id', id)
          .single();

        if (fetchError || !existingMessage) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Message not found', details: {} },
          });
        }

        if (existingMessage.author_id !== user.id) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'You can only delete your own messages', details: {} },
          });
        }

        // Soft delete
        const { error } = await supabaseAdmin
          .from('dm_messages')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          fastify.log.error({ error, messageId: id }, 'Failed to delete DM message');
          return reply.code(500).send({
            error: { code: 'DELETE_FAILED', message: 'Failed to delete message', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { message: 'Message deleted' },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in DELETE /api/dm/messages/:id');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * POST /api/dm/messages/:id/reactions
   * Add a reaction to a DM message
   */
  fastify.post(
    '/api/dm/messages/:id/reactions',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };
        const body = reactionSchema.parse(request.body);

        // Verify message exists and user is a participant
        const { data: existingMessage, error: fetchError } = await supabaseAdmin
          .from('dm_messages')
          .select('id, conversation_id')
          .eq('id', id)
          .single();

        if (fetchError || !existingMessage) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Message not found', details: {} },
          });
        }

        // Verify user is a participant
        const { data: participation } = await supabaseAdmin
          .from('dm_participants')
          .select('conversation_id')
          .eq('conversation_id', existingMessage.conversation_id)
          .eq('user_id', user.id)
          .single();

        if (!participation) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'You are not a participant in this conversation', details: {} },
          });
        }

        const { data: reaction, error } = await supabaseAdmin
          .from('dm_reactions')
          .insert({
            message_id: id,
            user_id: user.id,
            emoji: body.emoji,
          })
          .select('id, message_id, emoji, user_id, created_at')
          .single();

        if (error) {
          if (error.code === '23505') {
            // Already reacted - toggle off
            const { error: deleteError } = await supabaseAdmin
              .from('dm_reactions')
              .delete()
              .eq('message_id', id)
              .eq('user_id', user.id)
              .eq('emoji', body.emoji);

            if (deleteError) {
              return reply.code(500).send({
                error: { code: 'TOGGLE_FAILED', message: 'Failed to toggle reaction', details: {} },
              });
            }

            return reply.code(200).send({
              success: true,
              data: { removed: true, emoji: body.emoji },
            });
          }

          fastify.log.error({ error, messageId: id }, 'Failed to add DM reaction');
          return reply.code(500).send({
            error: { code: 'REACTION_FAILED', message: 'Failed to add reaction', details: {} },
          });
        }

        return reply.code(201).send({
          success: true,
          data: { reaction },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/dm/messages/:id/reactions');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * PUT /api/dm/conversations/:id/read
   * Mark a DM conversation as read
   */
  fastify.put(
    '/api/dm/conversations/:id/read',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        const { error } = await supabaseAdmin
          .from('dm_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', id)
          .eq('user_id', user.id);

        if (error) {
          fastify.log.error({ error, conversationId: id }, 'Failed to mark DM as read');
          return reply.code(500).send({
            error: { code: 'UPDATE_FAILED', message: 'Failed to mark as read', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { message: 'Conversation marked as read' },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in PUT /api/dm/conversations/:id/read');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );

  /**
   * PUT /api/dm/conversations/:id/mute
   * Toggle mute status for a DM conversation
   */
  fastify.put(
    '/api/dm/conversations/:id/mute',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const { id } = request.params as { id: string };

        // Get current mute status
        const { data: participation, error: fetchError } = await supabaseAdmin
          .from('dm_participants')
          .select('is_muted')
          .eq('conversation_id', id)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !participation) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Conversation not found', details: {} },
          });
        }

        const { error } = await supabaseAdmin
          .from('dm_participants')
          .update({ is_muted: !participation.is_muted })
          .eq('conversation_id', id)
          .eq('user_id', user.id);

        if (error) {
          fastify.log.error({ error, conversationId: id }, 'Failed to toggle DM mute');
          return reply.code(500).send({
            error: { code: 'UPDATE_FAILED', message: 'Failed to toggle mute', details: {} },
          });
        }

        return reply.code(200).send({
          success: true,
          data: { is_muted: !participation.is_muted },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Unexpected error in PUT /api/dm/conversations/:id/mute');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
        });
      }
    }
  );
}
