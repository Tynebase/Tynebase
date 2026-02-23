/**
 * Discussions API Service Layer
 *
 * Provides functions for interacting with the backend /api/discussions endpoints.
 * Handles discussion listing, creation, and replies.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Discussion {
  id: string;
  tenant_id?: string | null;
  title: string;
  content: string;
  category: string;
  author_id?: string;
  created_at: string;
  updated_at: string;
  replies_count: number;
  views_count: number;
  likes_count: number;
  is_pinned: boolean;
  is_resolved: boolean;
  is_locked?: boolean;
  tags: string[];
  poll?: Poll | null;
  has_liked?: boolean;
  author?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url?: string | null;
  };
}

export interface DiscussionReply {
  id: string;
  content: string;
  parent_id?: string | null;
  is_accepted_answer: boolean;
  likes_count: number;
  has_liked?: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url?: string | null;
  };
}

export interface PollOption {
  id: string;
  text: string;
  votes_count: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  total_votes: number;
  has_voted: boolean;
  selected_option_id?: string | null;
  created_at: string;
  ends_at?: string | null;
}

export interface DiscussionListParams {
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: 'recent' | 'popular' | 'unanswered';
}

export interface CreateDiscussionData {
  title: string;
  content: string;
  category: string;
  tags?: string[];
  poll?: {
    question: string;
    options: string[];
  };
}

export interface DiscussionListResponse {
  discussions: Discussion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface DiscussionResponse {
  discussion: Discussion;
}

export interface RepliesResponse {
  replies: DiscussionReply[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List discussions with optional filtering and pagination
 */
export async function listDiscussions(
  params?: DiscussionListParams
): Promise<DiscussionListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.category && params.category !== 'all') {
    queryParams.append('category', params.category);
  }

  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }

  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }

  if (params?.sortBy) {
    queryParams.append('sortBy', params.sortBy);
  }

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/discussions?${queryString}` : '/api/discussions';

  return apiGet<DiscussionListResponse>(endpoint);
}

/**
 * Create a new discussion
 */
export async function createDiscussion(
  data: CreateDiscussionData
): Promise<DiscussionResponse> {
  return apiPost<DiscussionResponse>('/api/discussions', data);
}

/**
 * Get a single discussion by ID
 */
export async function getDiscussion(id: string): Promise<DiscussionResponse> {
  return apiGet<DiscussionResponse>(`/api/discussions/${id}`);
}

/**
 * Update a discussion
 */
export async function updateDiscussion(
  id: string,
  data: Partial<CreateDiscussionData>
): Promise<DiscussionResponse> {
  return apiPatch<DiscussionResponse>(`/api/discussions/${id}`, data);
}

/**
 * Delete a discussion
 */
export async function deleteDiscussion(id: string): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>(`/api/discussions/${id}`);
}

/**
 * Toggle like on a discussion
 */
export async function toggleDiscussionLike(id: string): Promise<{ liked: boolean }> {
  return apiPost<{ liked: boolean }>(`/api/discussions/${id}/like`, {});
}

/**
 * Toggle pin on a discussion (admin/editor only)
 */
export async function toggleDiscussionPin(id: string): Promise<{ is_pinned: boolean }> {
  return apiPost<{ is_pinned: boolean }>(`/api/discussions/${id}/pin`, {});
}

/**
 * Toggle lock on a discussion (admin/editor only)
 */
export async function toggleDiscussionLock(id: string): Promise<{ is_locked: boolean }> {
  return apiPost<{ is_locked: boolean }>(`/api/discussions/${id}/lock`, {});
}

/**
 * Toggle resolved status on a discussion
 */
export async function toggleDiscussionResolved(id: string): Promise<{ is_resolved: boolean }> {
  return apiPost<{ is_resolved: boolean }>(`/api/discussions/${id}/resolve`, {});
}

/**
 * Get replies for a discussion
 */
export async function getDiscussionReplies(
  discussionId: string,
  params?: { page?: number; limit?: number }
): Promise<RepliesResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  
  const queryString = queryParams.toString();
  const endpoint = queryString 
    ? `/api/discussions/${discussionId}/replies?${queryString}` 
    : `/api/discussions/${discussionId}/replies`;

  return apiGet<RepliesResponse>(endpoint);
}

/**
 * Create a reply to a discussion
 */
export async function createReply(
  discussionId: string,
  data: { content: string; parent_id?: string }
): Promise<{ reply: DiscussionReply }> {
  return apiPost<{ reply: DiscussionReply }>(`/api/discussions/${discussionId}/replies`, data);
}

/**
 * Update a reply
 */
export async function updateReply(
  discussionId: string,
  replyId: string,
  data: { content: string }
): Promise<{ reply: DiscussionReply }> {
  return apiPatch<{ reply: DiscussionReply }>(`/api/discussions/${discussionId}/replies/${replyId}`, data);
}

/**
 * Delete a reply
 */
export async function deleteReply(
  discussionId: string,
  replyId: string
): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>(`/api/discussions/${discussionId}/replies/${replyId}`);
}

/**
 * Toggle like on a reply
 */
export async function toggleReplyLike(
  discussionId: string,
  replyId: string
): Promise<{ liked: boolean }> {
  return apiPost<{ liked: boolean }>(`/api/discussions/${discussionId}/replies/${replyId}/like`, {});
}

/**
 * Accept a reply as the answer
 */
export async function acceptReplyAsAnswer(
  discussionId: string,
  replyId: string
): Promise<{ is_accepted_answer: boolean }> {
  return apiPost<{ is_accepted_answer: boolean }>(`/api/discussions/${discussionId}/replies/${replyId}/accept`, {});
}

/**
 * Vote on a poll
 */
export async function voteOnPoll(
  discussionId: string,
  optionId: string
): Promise<{ poll: Poll }> {
  return apiPost<{ poll: Poll }>(`/api/discussions/${discussionId}/poll/vote`, { optionId });
}

/**
 * Remove vote from a poll
 */
export async function removePollVote(
  discussionId: string
): Promise<{ poll: Poll }> {
  return apiPost<{ poll: Poll }>(`/api/discussions/${discussionId}/poll/remove-vote`, {});
}

/**
 * Create a draft discussion (pre-creates ID for asset uploads)
 */
export async function createDraftDiscussion(
  data?: { title?: string; category?: string }
): Promise<{ discussion_id: string }> {
  return apiPost<{ discussion_id: string }>('/api/discussions/draft', data || {});
}

/**
 * Upload an asset (image/video) for a discussion
 */
export async function uploadDiscussionAsset(
  discussionId: string,
  file: File
): Promise<{ signed_url: string; filename: string; asset_type: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const subdomain = typeof window !== 'undefined' ? localStorage.getItem('tenant_subdomain') : null;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/discussions/${discussionId}/upload`,
    {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(subdomain ? { 'X-Tenant-Subdomain': subdomain } : {}),
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Failed to upload asset');
  }

  return response.json();
}
