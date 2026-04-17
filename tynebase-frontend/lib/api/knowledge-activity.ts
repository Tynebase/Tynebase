import { apiGet } from './client';

/**
 * Activity types from the backend lineage_event_type enum
 */
export type ActivityType =
  | 'created'
  | 'ai_generated'
  | 'converted_from_video'
  | 'converted_from_pdf'
  | 'converted_from_docx'
  | 'converted_from_url'
  | 'published'
  | 'unpublished'
  | 'ai_enhanced'
  | 'edited'
  | 'deleted';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actor: {
    id: string | null;
    name: string;
    email: string | null;
  };
  target: {
    id: string;
    title: string;
  };
  detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ActivityResponse {
  activities: ActivityItem[];
  pagination: ActivityPagination;
}

export interface ActivityTypeOption {
  value: ActivityType;
  label: string;
}

export interface ActivityTypesResponse {
  types: ActivityTypeOption[];
}

export interface GetActivityParams {
  page?: number;
  limit?: number;
  type?: ActivityType;
  search?: string;
  actor_id?: string;
  document_id?: string;
  from_date?: string;
  to_date?: string;
}

/**
 * Get knowledge base activity feed with pagination and filtering
 */
export async function getKnowledgeActivity(
  params: GetActivityParams = {}
): Promise<ActivityResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.type) searchParams.set('type', params.type);
  if (params.search) searchParams.set('search', params.search);
  if (params.actor_id) searchParams.set('actor_id', params.actor_id);
  if (params.document_id) searchParams.set('document_id', params.document_id);
  if (params.from_date) searchParams.set('from_date', params.from_date);
  if (params.to_date) searchParams.set('to_date', params.to_date);

  const queryString = searchParams.toString();
  const endpoint = `/api/knowledge/activity${queryString ? `?${queryString}` : ''}`;

  return apiGet<ActivityResponse>(endpoint);
}

/**
 * Get available activity types for filtering
 */
export async function getActivityTypes(): Promise<ActivityTypesResponse> {
  return apiGet<ActivityTypesResponse>('/api/knowledge/activity/types');
}
