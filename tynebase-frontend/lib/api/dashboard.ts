import { apiGet } from './client';

export interface DashboardStats {
  documents: {
    total: number;
    published: number;
    draft: number;
  };
  team: {
    members: number;
  };
  ai: {
    generations: number;
    credits_remaining: number;
    credits_total: number;
  };
  storage: {
    used_bytes?: number;
    used_mb?: number;
    used_gb: number;
    limit_mb?: number;
    limit_gb: number;
    percentage: number;
  };
  content_health: {
    percentage: number;
  };
}

export interface RecentDocument {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  author_id: string;
}

export interface RecentActivity {
  id: string;
  event_type: string;
  created_at: string;
  actor_id: string;
  document_id: string;
  documents: {
    title: string;
  } | null;
  users: {
    full_name: string | null;
    email: string;
  } | null;
}

export interface DashboardStatsResponse {
  success: true;
  data: DashboardStats;
}

export interface RecentDocumentsResponse {
  success: true;
  data: {
    documents: RecentDocument[];
  };
}

export interface RecentActivityResponse {
  success: true;
  data: {
    activities: RecentActivity[];
  };
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/api/dashboard/stats');
}

/**
 * Get recent documents
 */
export async function getRecentDocuments(): Promise<{ documents: RecentDocument[] }> {
  return apiGet<{ documents: RecentDocument[] }>('/api/dashboard/recent-documents');
}

/**
 * Get recent activity
 */
export async function getRecentActivity(): Promise<{ activities: RecentActivity[] }> {
  return apiGet<{ activities: RecentActivity[] }>('/api/dashboard/recent-activity');
}
