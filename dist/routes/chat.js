"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = chatRoutes;
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const rateLimit_1 = require("../middleware/rateLimit");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const membershipGuard_1 = require("../middleware/membershipGuard");
const auditLog_1 = require("../lib/auditLog");
const notifications_1 = require("../services/notifications");
/**
 * Zod schemas for chat API
 */
const createChannelSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Channel name must be lowercase alphanumeric with hyphens'),
    description: zod_1.z.string().max(500).optional(),
    is_private: zod_1.z.boolean().default(false),
});
const sendMessageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(4000),
    parent_id: zod_1.z.string().uuid().optional(),
});
const editMessageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(4000),
});
const reactionSchema = zod_1.z.object({
    emoji: zod_1.z.string().min(1).max(10),
});
/**
 * Team Chat routes
 */
async function chatRoutes(fastify) {
    /**
     * GET /api/chat/channels
     * List all channels for the tenant
     */
    fastify.get('/api/chat/channels', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            // Get channels with unread counts
            const { data: channels, error } = await supabase_1.supabaseAdmin
                .from('chat_channels')
                .select(`
            id,
            name,
            description,
            is_private,
            created_by,
            created_at
          `)
                .eq('tenant_id', tenant.id)
                .order('name');
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch channels');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch channels',
                        details: {},
                    },
                });
            }
            // Get read receipts for the user
            const { data: readReceipts } = await supabase_1.supabaseAdmin
                .from('chat_read_receipts')
                .select('channel_id, last_read_at')
                .eq('user_id', user.id);
            const readReceiptsMap = new Map((readReceipts || []).map(r => [r.channel_id, r.last_read_at]));
            // Get unread counts for each channel
            const channelsWithUnread = await Promise.all((channels || []).map(async (channel) => {
                const lastReadAt = readReceiptsMap.get(channel.id);
                let unreadCount = 0;
                if (lastReadAt) {
                    const { count } = await supabase_1.supabaseAdmin
                        .from('chat_messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('channel_id', channel.id)
                        .is('deleted_at', null)
                        .gt('created_at', lastReadAt);
                    unreadCount = count || 0;
                }
                else {
                    // No read receipt = all messages are unread (up to 100)
                    const { count } = await supabase_1.supabaseAdmin
                        .from('chat_messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('channel_id', channel.id)
                        .is('deleted_at', null);
                    unreadCount = Math.min(count || 0, 99);
                }
                return {
                    ...channel,
                    unread_count: unreadCount,
                };
            }));
            return reply.code(200).send({
                success: true,
                data: {
                    channels: channelsWithUnread,
                },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in GET /api/chat/channels');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * POST /api/chat/channels
     * Create a new channel (admin only)
     */
    fastify.post('/api/chat/channels', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            // Only admins can create channels
            if (!['admin', 'super_admin'].includes(user.role)) {
                return reply.code(403).send({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Only admins can create channels',
                        details: {},
                    },
                });
            }
            const body = createChannelSchema.parse(request.body);
            const { data: channel, error } = await supabase_1.supabaseAdmin
                .from('chat_channels')
                .insert({
                tenant_id: tenant.id,
                name: body.name,
                description: body.description,
                is_private: body.is_private,
                created_by: user.id,
            })
                .select()
                .single();
            if (error) {
                if (error.code === '23505') {
                    return reply.code(400).send({
                        error: {
                            code: 'DUPLICATE_NAME',
                            message: 'A channel with this name already exists',
                            details: {},
                        },
                    });
                }
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to create channel');
                return reply.code(500).send({
                    error: {
                        code: 'CREATE_FAILED',
                        message: 'Failed to create channel',
                        details: {},
                    },
                });
            }
            (0, auditLog_1.writeAuditLog)({
                tenantId: tenant.id,
                actorId: user.id,
                action: 'chat.channel_created',
                actionType: 'chat',
                targetName: body.name,
                ipAddress: (0, auditLog_1.getClientIp)(request),
                metadata: { channel_id: channel.id },
            });
            return reply.code(201).send({
                success: true,
                data: { channel },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                    },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in POST /api/chat/channels');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * POST /api/chat/channels/init
     * Initialize default channels for the tenant (admin only)
     */
    fastify.post('/api/chat/channels/init', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            // Only admins can initialize channels
            if (!['admin', 'super_admin'].includes(user.role)) {
                return reply.code(403).send({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Only admins can initialize channels',
                        details: {},
                    },
                });
            }
            // Call the function to create default channels
            const { error } = await supabase_1.supabaseAdmin.rpc('create_default_chat_channels', {
                p_tenant_id: tenant.id,
                p_created_by: user.id,
            });
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to initialize channels');
                return reply.code(500).send({
                    error: {
                        code: 'INIT_FAILED',
                        message: 'Failed to initialize default channels',
                        details: {},
                    },
                });
            }
            // Fetch the created channels
            const { data: channels } = await supabase_1.supabaseAdmin
                .from('chat_channels')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('name');
            return reply.code(200).send({
                success: true,
                data: { channels: channels || [] },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in POST /api/chat/channels/init');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * GET /api/chat/channels/:id/messages
     * Get messages for a channel (paginated, last 100 by default)
     */
    fastify.get('/api/chat/channels/:id/messages', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const { id } = request.params;
            const query = request.query;
            const limit = Math.min(parseInt(query.limit || '100', 10), 100);
            const before = query.before;
            const parentId = query.parent_id;
            // Verify channel belongs to tenant
            const { data: channel, error: channelError } = await supabase_1.supabaseAdmin
                .from('chat_channels')
                .select('id')
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .single();
            if (channelError || !channel) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Channel not found',
                        details: {},
                    },
                });
            }
            // Build query
            let messagesQuery = supabase_1.supabaseAdmin
                .from('chat_messages')
                .select(`
            id,
            content,
            parent_id,
            edited_at,
            deleted_at,
            created_at,
            author:users!chat_messages_author_id_fkey (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
                .eq('channel_id', id)
                .is('deleted_at', null);
            // Filter by parent_id for thread replies
            if (parentId) {
                messagesQuery = messagesQuery.eq('parent_id', parentId);
            }
            else {
                // Top-level messages only
                messagesQuery = messagesQuery.is('parent_id', null);
            }
            // Pagination
            if (before) {
                messagesQuery = messagesQuery.lt('created_at', before);
            }
            messagesQuery = messagesQuery
                .order('created_at', { ascending: false })
                .limit(limit);
            const { data: messages, error } = await messagesQuery;
            if (error) {
                fastify.log.error({ error, channelId: id }, 'Failed to fetch messages');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch messages',
                        details: {},
                    },
                });
            }
            // Get reactions for these messages
            const messageIds = (messages || []).map(m => m.id);
            const { data: reactions } = await supabase_1.supabaseAdmin
                .from('chat_reactions')
                .select(`
            id,
            message_id,
            emoji,
            user_id,
            user:users!chat_reactions_user_id_fkey (
              id,
              full_name
            )
          `)
                .in('message_id', messageIds);
            // Get reply counts for top-level messages
            const replyCounts = {};
            if (!parentId && messageIds.length > 0) {
                const { data: replyData } = await supabase_1.supabaseAdmin
                    .from('chat_messages')
                    .select('parent_id')
                    .in('parent_id', messageIds)
                    .is('deleted_at', null);
                (replyData || []).forEach(r => {
                    if (r.parent_id) {
                        replyCounts[r.parent_id] = (replyCounts[r.parent_id] || 0) + 1;
                    }
                });
            }
            // Group reactions by message
            const reactionsMap = {};
            (reactions || []).forEach(r => {
                if (!reactionsMap[r.message_id]) {
                    reactionsMap[r.message_id] = [];
                }
                reactionsMap[r.message_id].push(r);
            });
            // Attach reactions and reply counts to messages
            const messagesWithReactions = (messages || []).map(m => ({
                ...m,
                reactions: reactionsMap[m.id] || [],
                reply_count: replyCounts[m.id] || 0,
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
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in GET /api/chat/channels/:id/messages');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * POST /api/chat/channels/:id/messages
     * Send a message to a channel
     */
    fastify.post('/api/chat/channels/:id/messages', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            // Verify channel belongs to tenant
            const { data: channel, error: channelError } = await supabase_1.supabaseAdmin
                .from('chat_channels')
                .select('id')
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .single();
            if (channelError || !channel) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Channel not found',
                        details: {},
                    },
                });
            }
            const body = sendMessageSchema.parse(request.body);
            // If replying to a message, verify parent exists
            if (body.parent_id) {
                const { data: parentMessage } = await supabase_1.supabaseAdmin
                    .from('chat_messages')
                    .select('id')
                    .eq('id', body.parent_id)
                    .eq('channel_id', id)
                    .single();
                if (!parentMessage) {
                    return reply.code(400).send({
                        error: {
                            code: 'INVALID_PARENT',
                            message: 'Parent message not found',
                            details: {},
                        },
                    });
                }
            }
            const { data: message, error } = await supabase_1.supabaseAdmin
                .from('chat_messages')
                .insert({
                tenant_id: tenant.id,
                channel_id: id,
                author_id: user.id,
                content: body.content,
                parent_id: body.parent_id || null,
            })
                .select(`
            id,
            content,
            parent_id,
            edited_at,
            deleted_at,
            created_at,
            author:users!chat_messages_author_id_fkey (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
                .single();
            if (error) {
                fastify.log.error({ error, channelId: id }, 'Failed to send message');
                return reply.code(500).send({
                    error: {
                        code: 'SEND_FAILED',
                        message: 'Failed to send message',
                        details: {},
                    },
                });
            }
            // Notify other tenant users about the new message (fire-and-forget)
            (async () => {
                try {
                    const { data: channelInfo } = await supabase_1.supabaseAdmin
                        .from('chat_channels')
                        .select('name')
                        .eq('id', id)
                        .single();
                    const { data: tenantUsers } = await supabase_1.supabaseAdmin
                        .from('users')
                        .select('id')
                        .eq('tenant_id', tenant.id)
                        .eq('status', 'active')
                        .neq('id', user.id);
                    if (tenantUsers?.length) {
                        const preview = body.content.length > 100 ? body.content.substring(0, 100) + '...' : body.content;
                        for (const tu of tenantUsers) {
                            (0, notifications_1.notifyChatMessage)({
                                userId: tu.id,
                                tenantId: tenant.id,
                                senderName: user.full_name || user.email,
                                channelName: channelInfo?.name,
                                messagePreview: preview,
                                channelId: id,
                            }).catch(() => { });
                        }
                    }
                }
                catch (err) {
                    fastify.log.error({ err }, 'Failed to send chat message notifications');
                }
            })();
            return reply.code(201).send({
                success: true,
                data: {
                    message: {
                        ...message,
                        reactions: [],
                        reply_count: 0,
                    },
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                    },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in POST /api/chat/channels/:id/messages');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * PATCH /api/chat/messages/:id
     * Edit a message (own only)
     */
    fastify.patch('/api/chat/messages/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            // Verify message exists and belongs to user
            const { data: existingMessage, error: fetchError } = await supabase_1.supabaseAdmin
                .from('chat_messages')
                .select('id, author_id, tenant_id')
                .eq('id', id)
                .single();
            if (fetchError || !existingMessage) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Message not found',
                        details: {},
                    },
                });
            }
            if (existingMessage.tenant_id !== tenant.id) {
                return reply.code(403).send({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Message does not belong to your workspace',
                        details: {},
                    },
                });
            }
            if (existingMessage.author_id !== user.id) {
                return reply.code(403).send({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You can only edit your own messages',
                        details: {},
                    },
                });
            }
            const body = editMessageSchema.parse(request.body);
            const { data: message, error } = await supabase_1.supabaseAdmin
                .from('chat_messages')
                .update({
                content: body.content,
                edited_at: new Date().toISOString(),
            })
                .eq('id', id)
                .select(`
            id,
            content,
            parent_id,
            edited_at,
            deleted_at,
            created_at,
            author:users!chat_messages_author_id_fkey (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
                .single();
            if (error) {
                fastify.log.error({ error, messageId: id }, 'Failed to edit message');
                return reply.code(500).send({
                    error: {
                        code: 'EDIT_FAILED',
                        message: 'Failed to edit message',
                        details: {},
                    },
                });
            }
            return reply.code(200).send({
                success: true,
                data: { message },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                    },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in PATCH /api/chat/messages/:id');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * DELETE /api/chat/messages/:id
     * Soft delete a message (own or admin)
     */
    fastify.delete('/api/chat/messages/:id', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            // Verify message exists
            const { data: existingMessage, error: fetchError } = await supabase_1.supabaseAdmin
                .from('chat_messages')
                .select('id, author_id, tenant_id')
                .eq('id', id)
                .single();
            if (fetchError || !existingMessage) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Message not found',
                        details: {},
                    },
                });
            }
            if (existingMessage.tenant_id !== tenant.id) {
                return reply.code(403).send({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Message does not belong to your workspace',
                        details: {},
                    },
                });
            }
            // Check permission: own message or admin
            const isOwner = existingMessage.author_id === user.id;
            const isAdmin = ['admin', 'super_admin'].includes(user.role);
            if (!isOwner && !isAdmin) {
                return reply.code(403).send({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You can only delete your own messages',
                        details: {},
                    },
                });
            }
            // Soft delete
            const { error } = await supabase_1.supabaseAdmin
                .from('chat_messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
            if (error) {
                fastify.log.error({ error, messageId: id }, 'Failed to delete message');
                return reply.code(500).send({
                    error: {
                        code: 'DELETE_FAILED',
                        message: 'Failed to delete message',
                        details: {},
                    },
                });
            }
            return reply.code(200).send({
                success: true,
                data: { message: 'Message deleted' },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in DELETE /api/chat/messages/:id');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * POST /api/chat/messages/:id/reactions
     * Add a reaction to a message
     */
    fastify.post('/api/chat/messages/:id/reactions', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            // Verify message exists and belongs to tenant
            const { data: existingMessage, error: fetchError } = await supabase_1.supabaseAdmin
                .from('chat_messages')
                .select('id, tenant_id')
                .eq('id', id)
                .single();
            if (fetchError || !existingMessage) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Message not found',
                        details: {},
                    },
                });
            }
            if (existingMessage.tenant_id !== tenant.id) {
                return reply.code(403).send({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Message does not belong to your workspace',
                        details: {},
                    },
                });
            }
            const body = reactionSchema.parse(request.body);
            const { data: reaction, error } = await supabase_1.supabaseAdmin
                .from('chat_reactions')
                .insert({
                message_id: id,
                user_id: user.id,
                emoji: body.emoji,
            })
                .select(`
            id,
            message_id,
            emoji,
            user_id,
            created_at
          `)
                .single();
            if (error) {
                if (error.code === '23505') {
                    // Already reacted with this emoji - remove it (toggle)
                    const { error: deleteError } = await supabase_1.supabaseAdmin
                        .from('chat_reactions')
                        .delete()
                        .eq('message_id', id)
                        .eq('user_id', user.id)
                        .eq('emoji', body.emoji);
                    if (deleteError) {
                        return reply.code(500).send({
                            error: {
                                code: 'TOGGLE_FAILED',
                                message: 'Failed to toggle reaction',
                                details: {},
                            },
                        });
                    }
                    return reply.code(200).send({
                        success: true,
                        data: { removed: true, emoji: body.emoji },
                    });
                }
                fastify.log.error({ error, messageId: id }, 'Failed to add reaction');
                return reply.code(500).send({
                    error: {
                        code: 'REACTION_FAILED',
                        message: 'Failed to add reaction',
                        details: {},
                    },
                });
            }
            return reply.code(201).send({
                success: true,
                data: { reaction },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                    },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in POST /api/chat/messages/:id/reactions');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * DELETE /api/chat/messages/:id/reactions/:emoji
     * Remove a reaction from a message
     */
    fastify.delete('/api/chat/messages/:id/reactions/:emoji', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const user = request.user;
            const { id, emoji } = request.params;
            const { error } = await supabase_1.supabaseAdmin
                .from('chat_reactions')
                .delete()
                .eq('message_id', id)
                .eq('user_id', user.id)
                .eq('emoji', decodeURIComponent(emoji));
            if (error) {
                fastify.log.error({ error, messageId: id, emoji }, 'Failed to remove reaction');
                return reply.code(500).send({
                    error: {
                        code: 'DELETE_FAILED',
                        message: 'Failed to remove reaction',
                        details: {},
                    },
                });
            }
            return reply.code(200).send({
                success: true,
                data: { message: 'Reaction removed' },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in DELETE /api/chat/messages/:id/reactions/:emoji');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * PUT /api/chat/channels/:id/read
     * Mark channel as read
     */
    fastify.put('/api/chat/channels/:id/read', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { id } = request.params;
            // Verify channel belongs to tenant
            const { data: channel, error: channelError } = await supabase_1.supabaseAdmin
                .from('chat_channels')
                .select('id')
                .eq('id', id)
                .eq('tenant_id', tenant.id)
                .single();
            if (channelError || !channel) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Channel not found',
                        details: {},
                    },
                });
            }
            // Upsert read receipt
            const { error } = await supabase_1.supabaseAdmin
                .from('chat_read_receipts')
                .upsert({
                user_id: user.id,
                channel_id: id,
                last_read_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,channel_id',
            });
            if (error) {
                fastify.log.error({ error, channelId: id }, 'Failed to mark channel as read');
                return reply.code(500).send({
                    error: {
                        code: 'UPDATE_FAILED',
                        message: 'Failed to mark channel as read',
                        details: {},
                    },
                });
            }
            return reply.code(200).send({
                success: true,
                data: { message: 'Channel marked as read' },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in PUT /api/chat/channels/:id/read');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
    /**
     * GET /api/chat/users
     * Get all users in the tenant for DM list
     */
    fastify.get('/api/chat/users', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            const { data: users, error } = await supabase_1.supabaseAdmin
                .from('users')
                .select('id, full_name, email, avatar_url, role, status')
                .eq('tenant_id', tenant.id)
                .eq('status', 'active')
                .neq('id', user.id)
                .order('full_name');
            if (error) {
                fastify.log.error({ error, tenantId: tenant.id }, 'Failed to fetch users');
                return reply.code(500).send({
                    error: {
                        code: 'FETCH_FAILED',
                        message: 'Failed to fetch users',
                        details: {},
                    },
                });
            }
            return reply.code(200).send({
                success: true,
                data: { users: users || [] },
            });
        }
        catch (error) {
            fastify.log.error({ error }, 'Unexpected error in GET /api/chat/users');
            return reply.code(500).send({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                },
            });
        }
    });
}
//# sourceMappingURL=chat.js.map