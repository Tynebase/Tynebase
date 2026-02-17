/**
 * Direct Messages API Service Layer
 * 
 * Provides functions for DM conversations, messages, and reactions.
 */

import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface DMUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface DMReaction {
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

export interface DMMessage {
  id: string;
  content: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  author: DMUser;
  reactions: DMReaction[];
}

export interface DMConversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants: DMUser[];
  other_user: DMUser | null;
  last_message: {
    content: string;
    created_at: string;
    author_id: string;
  } | null;
  unread_count: number;
  is_muted: boolean;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

export interface ListConversationsResponse {
  conversations: DMConversation[];
}

/**
 * List all DM conversations for the current user
 */
export async function listDMConversations(): Promise<ListConversationsResponse> {
  return apiGet<ListConversationsResponse>('/api/dm/conversations');
}

export interface StartConversationRequest {
  user_id: string;
}

export interface StartConversationResponse {
  conversation: DMConversation;
}

/**
 * Start a new DM conversation with a user (or get existing one)
 */
export async function startDMConversation(data: StartConversationRequest): Promise<StartConversationResponse> {
  return apiPost<StartConversationResponse>('/api/dm/conversations', data);
}

// ============================================================================
// MESSAGES
// ============================================================================

export interface ListDMMessagesParams {
  limit?: number;
  before?: string;
}

export interface ListDMMessagesResponse {
  messages: DMMessage[];
  has_more: boolean;
}

/**
 * Get messages for a DM conversation
 */
export async function listDMMessages(
  conversationId: string,
  params?: ListDMMessagesParams
): Promise<ListDMMessagesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.before) searchParams.set('before', params.before);
  
  const query = searchParams.toString();
  const url = `/api/dm/conversations/${conversationId}/messages${query ? `?${query}` : ''}`;
  return apiGet<ListDMMessagesResponse>(url);
}

export interface SendDMMessageRequest {
  content: string;
}

export interface SendDMMessageResponse {
  message: DMMessage;
}

/**
 * Send a message to a DM conversation
 */
export async function sendDMMessage(
  conversationId: string,
  data: SendDMMessageRequest
): Promise<SendDMMessageResponse> {
  return apiPost<SendDMMessageResponse>(`/api/dm/conversations/${conversationId}/messages`, data);
}

export interface EditDMMessageRequest {
  content: string;
}

export interface EditDMMessageResponse {
  message: DMMessage;
}

/**
 * Edit a DM message (own only)
 */
export async function editDMMessage(
  messageId: string,
  data: EditDMMessageRequest
): Promise<EditDMMessageResponse> {
  return apiPatch<EditDMMessageResponse>(`/api/dm/messages/${messageId}`, data);
}

/**
 * Delete a DM message (soft delete, own only)
 */
export async function deleteDMMessage(messageId: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/dm/messages/${messageId}`);
}

// ============================================================================
// REACTIONS
// ============================================================================

export interface AddDMReactionRequest {
  emoji: string;
}

export interface AddDMReactionResponse {
  reaction?: DMReaction;
  removed?: boolean;
  emoji?: string;
}

/**
 * Add or toggle a reaction on a DM message
 */
export async function addDMReaction(
  messageId: string,
  data: AddDMReactionRequest
): Promise<AddDMReactionResponse> {
  return apiPost<AddDMReactionResponse>(`/api/dm/messages/${messageId}/reactions`, data);
}

// ============================================================================
// READ STATUS
// ============================================================================

/**
 * Mark a DM conversation as read
 */
export async function markDMAsRead(conversationId: string): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`/api/dm/conversations/${conversationId}/read`, {});
}

/**
 * Toggle mute status for a DM conversation
 */
export async function toggleDMMute(conversationId: string): Promise<{ is_muted: boolean }> {
  return apiPut<{ is_muted: boolean }>(`/api/dm/conversations/${conversationId}/mute`, {});
}
