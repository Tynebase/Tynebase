/**
 * Team Chat API Service Layer
 * 
 * Provides functions for team chat channels, messages, reactions, and read receipts.
 */

import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  unread_count: number;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  emoji: string;
  user_id: string;
  user?: {
    id: string;
    full_name: string | null;
  };
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  parent_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  author: ChatUser;
  reactions: ChatReaction[];
  reply_count: number;
}

// ============================================================================
// CHANNELS
// ============================================================================

export interface ListChannelsResponse {
  channels: ChatChannel[];
}

/**
 * List all channels for the tenant
 */
export async function listChannels(): Promise<ListChannelsResponse> {
  return apiGet<ListChannelsResponse>('/api/chat/channels');
}

export interface CreateChannelRequest {
  name: string;
  description?: string;
  is_private?: boolean;
}

export interface CreateChannelResponse {
  channel: ChatChannel;
}

/**
 * Create a new channel (admin only)
 */
export async function createChannel(data: CreateChannelRequest): Promise<CreateChannelResponse> {
  return apiPost<CreateChannelResponse>('/api/chat/channels', data);
}

/**
 * Initialize default channels for the tenant (admin only)
 */
export async function initializeChannels(): Promise<ListChannelsResponse> {
  return apiPost<ListChannelsResponse>('/api/chat/channels/init', {});
}

// ============================================================================
// MESSAGES
// ============================================================================

export interface ListMessagesParams {
  limit?: number;
  before?: string;
  parent_id?: string;
}

export interface ListMessagesResponse {
  messages: ChatMessage[];
  has_more: boolean;
}

/**
 * Get messages for a channel (paginated)
 */
export async function listMessages(
  channelId: string,
  params?: ListMessagesParams
): Promise<ListMessagesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.before) searchParams.set('before', params.before);
  if (params?.parent_id) searchParams.set('parent_id', params.parent_id);
  
  const query = searchParams.toString();
  const url = `/api/chat/channels/${channelId}/messages${query ? `?${query}` : ''}`;
  return apiGet<ListMessagesResponse>(url);
}

export interface SendMessageRequest {
  content: string;
  parent_id?: string;
}

export interface SendMessageResponse {
  message: ChatMessage;
}

/**
 * Send a message to a channel
 */
export async function sendMessage(
  channelId: string,
  data: SendMessageRequest
): Promise<SendMessageResponse> {
  return apiPost<SendMessageResponse>(`/api/chat/channels/${channelId}/messages`, data);
}

export interface EditMessageRequest {
  content: string;
}

export interface EditMessageResponse {
  message: ChatMessage;
}

/**
 * Edit a message (own only)
 */
export async function editMessage(
  messageId: string,
  data: EditMessageRequest
): Promise<EditMessageResponse> {
  return apiPatch<EditMessageResponse>(`/api/chat/messages/${messageId}`, data);
}

/**
 * Delete a message (soft delete, own or admin)
 */
export async function deleteMessage(messageId: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/chat/messages/${messageId}`);
}

// ============================================================================
// REACTIONS
// ============================================================================

export interface AddReactionRequest {
  emoji: string;
}

export interface AddReactionResponse {
  reaction?: ChatReaction;
  removed?: boolean;
  emoji?: string;
}

/**
 * Add or toggle a reaction on a message
 */
export async function addReaction(
  messageId: string,
  data: AddReactionRequest
): Promise<AddReactionResponse> {
  return apiPost<AddReactionResponse>(`/api/chat/messages/${messageId}/reactions`, data);
}

/**
 * Remove a reaction from a message
 */
export async function removeReaction(
  messageId: string,
  emoji: string
): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(
    `/api/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`
  );
}

// ============================================================================
// READ RECEIPTS
// ============================================================================

/**
 * Mark a channel as read
 */
export async function markChannelAsRead(channelId: string): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`/api/chat/channels/${channelId}/read`, {});
}

// ============================================================================
// USERS
// ============================================================================

export interface ChatUserInfo {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
  status: string;
}

export interface ListChatUsersResponse {
  users: ChatUserInfo[];
}

/**
 * Get all users in the tenant for DM list
 */
export async function listChatUsers(): Promise<ListChatUsersResponse> {
  return apiGet<ListChatUsersResponse>('/api/chat/users');
}

// ============================================================================
// ASSIGNMENTS
// ============================================================================

export interface ChatAssignment {
  id: string;
  assignment_type: 'document' | 'task';
  title: string | null;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  document_id: string | null;
  channel_id: string | null;
  assigned_by_user: { id: string; full_name: string | null; email: string } | null;
  assigned_to_user: { id: string; full_name: string | null; email: string } | null;
  document: { id: string; title: string } | null;
}

export interface CreateAssignmentRequest {
  assigned_to: string;
  assignment_type: 'document' | 'task';
  document_id?: string;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  channel_id?: string;
}

export interface ListAssignmentsParams {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'all';
  type?: 'document' | 'task' | 'all';
  assigned_to?: string;
  limit?: number;
}

export async function listAssignments(params: ListAssignmentsParams = {}): Promise<{ assignments: ChatAssignment[] }> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.type) sp.set('type', params.type);
  if (params.assigned_to) sp.set('assigned_to', params.assigned_to);
  if (params.limit) sp.set('limit', params.limit.toString());
  const qs = sp.toString();
  return apiGet<{ assignments: ChatAssignment[] }>(`/api/chat/assignments${qs ? `?${qs}` : ''}`);
}

export async function listMyAssignments(params: ListAssignmentsParams = {}): Promise<{ assignments: ChatAssignment[] }> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.type) sp.set('type', params.type);
  if (params.limit) sp.set('limit', params.limit.toString());
  const qs = sp.toString();
  return apiGet<{ assignments: ChatAssignment[] }>(`/api/chat/assignments/my${qs ? `?${qs}` : ''}`);
}

export async function createAssignment(data: CreateAssignmentRequest): Promise<{ assignment: ChatAssignment }> {
  return apiPost<{ assignment: ChatAssignment }>('/api/chat/assignments', data);
}

export async function updateAssignment(id: string, data: { status?: string; priority?: string; due_date?: string | null }): Promise<{ assignment: ChatAssignment }> {
  return apiPatch<{ assignment: ChatAssignment }>(`/api/chat/assignments/${id}`, data);
}

// ============================================================================
// DIRECT MESSAGES (Legacy DM channel approach)
// ============================================================================

export async function createDMChannel(
  currentUserId: string,
  targetUserId: string,
  targetUserName: string
): Promise<CreateChannelResponse> {
  // Create a consistent channel name regardless of who initiates
  const sortedIds = [currentUserId, targetUserId].sort();
  const channelName = `dm-${sortedIds[0].slice(0, 8)}-${sortedIds[1].slice(0, 8)}`;
  
  return apiPost<CreateChannelResponse>('/api/chat/channels', {
    name: channelName,
    description: `Direct message with ${targetUserName}`,
    is_private: true,
  });
}
