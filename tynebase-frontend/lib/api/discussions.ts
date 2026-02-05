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
  category: 'announcements' | 'questions' | 'ideas' | 'general';
  author_id: string;
  created_at: string;
  updated_at: string;
  replies_count: number;
  views_count: number;
  likes_count: number;
  is_pinned: boolean;
  is_resolved: boolean;
  tags: string[];
  author?: {
    id: string;
    email: string;
    full_name: string | null;
  };
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
  category: 'announcements' | 'questions' | 'ideas' | 'general';
  tags?: string[];
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
