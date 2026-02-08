/**
 * Discussions API Service Layer
 *
 * Provides functions for interacting with the backend /api/discussions endpoints.
 * Handles discussion listing, creation, and replies.
 */

import { apiGet, apiPost } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Discussion {
  id: string;
  tenant_id: string | null;
  title: string;
  content: string;
  category: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  replies_count: number;
  views_count: number;
  likes_count: number;
  is_pinned: boolean;
  is_resolved: boolean;
  tags: string[];
  poll?: Poll;
  author?: {
    id: string;
    email: string;
    full_name: string | null;
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
  selected_option_id?: string;
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

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List discussions with optional filtering and pagination
 *
 * @param params - Query parameters for filtering and pagination
 * @returns List of discussions with pagination metadata
 */
export async function listDiscussions(
  params?: DiscussionListParams
): Promise<DiscussionListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.category) {
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
 *
 * @param data - Discussion creation data
 * @returns Created discussion details
 */
export async function createDiscussion(
  data: CreateDiscussionData
): Promise<DiscussionResponse> {
  return apiPost<DiscussionResponse>('/api/discussions', data);
}

/**
 * Get a single discussion by ID
 *
 * @param id - Discussion UUID
 * @returns Discussion details
 */
export async function getDiscussion(id: string): Promise<DiscussionResponse> {
  return apiGet<DiscussionResponse>(`/api/discussions/${id}`);
}

/**
 * Vote on a poll
 *
 * @param discussionId - Discussion UUID containing the poll
 * @param optionId - Poll option ID to vote for
 * @returns Updated poll data
 */
export async function voteOnPoll(
  discussionId: string,
  optionId: string
): Promise<{ poll: Poll }> {
  return apiPost<{ poll: Poll }>(`/api/discussions/${discussionId}/poll/vote`, { optionId });
}

/**
 * Remove vote from a poll
 *
 * @param discussionId - Discussion UUID containing the poll
 * @returns Updated poll data
 */
export async function removePollVote(
  discussionId: string
): Promise<{ poll: Poll }> {
  return apiPost<{ poll: Poll }>(`/api/discussions/${discussionId}/poll/remove-vote`, {});
}
