import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export interface ContentHealthStat {
  value: string | number;
  change: string;
  positive: boolean;
}

export interface AuditStats {
  stats: {
    content_health: ContentHealthStat;
    total_documents: ContentHealthStat;
    needs_review: ContentHealthStat;
    stale_content: ContentHealthStat;
  };
  health_distribution: {
    excellent: { count: number; percentage: number };
    good: { count: number; percentage: number };
    needs_review: { count: number; percentage: number };
    poor: { count: number; percentage: number };
  };
}

export interface StaleDocument {
  id: string;
  title: string;
  last_updated: string;
  views: number;
  status: 'critical' | 'warning' | 'info';
}

export interface TopPerformer {
  id: string;
  title: string;
  views: number;
  trend: string;
  positive: boolean;
}

export interface DocumentReview {
  id: string;
  title: string;
  document_id: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  due_date: string;
  due_date_raw: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface CreateReviewParams {
  document_id: string;
  reason: string;
  priority?: 'low' | 'medium' | 'high';
  due_date: string;
  assigned_to?: string;
  notes?: string;
}

export interface UpdateReviewParams {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  assigned_to?: string | null;
  notes?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actor: {
    name: string;
    email: string;
    avatar: string;
  };
  target: string | null;
  timestamp: string;
  ip: string;
  type: string;
  details: Record<string, any>;
}

export interface AuditLogsParams {
  page?: number;
  limit?: number;
  action_type?: 'all' | 'document' | 'user' | 'auth' | 'settings';
  search?: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Get audit logs with pagination and filtering
 */
export async function getAuditLogs(params: AuditLogsParams = {}): Promise<AuditLogsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.action_type) searchParams.append('action_type', params.action_type);
  if (params.search) searchParams.append('search', params.search);
  
  const queryString = searchParams.toString();
  const response = await apiGet<AuditLogsResponse>(`/api/audit/logs${queryString ? `?${queryString}` : ''}`);
  return response || { logs: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } };
}

/**
 * Export audit logs as CSV file
 */
export async function exportAuditLogs(params: Omit<AuditLogsParams, 'page' | 'limit'> = {}): Promise<void> {
  const searchParams = new URLSearchParams();
  
  if (params.action_type) searchParams.append('action_type', params.action_type);
  if (params.search) searchParams.append('search', params.search);
  
  const queryString = searchParams.toString();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const url = `${API_BASE_URL}/api/audit/logs/export${queryString ? `?${queryString}` : ''}`;
  
  // Get auth token and tenant subdomain
  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const tenantSubdomain = typeof window !== 'undefined' ? localStorage.getItem('tenant_subdomain') : null;
  
  if (!accessToken) {
    throw new Error('Authentication required');
  }
  
  // Fetch the CSV file
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-subdomain': tenantSubdomain || '',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to export audit logs');
  }
  
  // Get the blob from response
  const blob = await response.blob();
  
  // Create a download link and trigger it
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Get content audit statistics
 */
export async function getAuditStats(days: number = 30): Promise<AuditStats> {
  return apiGet<AuditStats>(`/api/audit/stats?days=${days}`);
}

/**
 * Get stale documents that need updates
 */
export async function getStaleDocuments(days: number = 90, limit: number = 10): Promise<{ documents: StaleDocument[] }> {
  const response = await apiGet<{ documents: StaleDocument[] }>(`/api/audit/stale-documents?days=${days}&limit=${limit}`);
  return response || { documents: [] };
}

/**
 * Get top performing documents by views
 */
export async function getTopPerformers(limit: number = 5): Promise<{ documents: TopPerformer[] }> {
  const response = await apiGet<{ documents: TopPerformer[] }>(`/api/audit/top-performers?limit=${limit}`);
  return response || { documents: [] };
}

/**
 * Get document review queue
 */
export async function getReviewQueue(
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'all' = 'pending',
  limit: number = 10
): Promise<{ reviews: DocumentReview[] }> {
  const response = await apiGet<{ reviews: DocumentReview[] }>(`/api/audit/reviews?status=${status}&limit=${limit}`);
  return response || { reviews: [] };
}

/**
 * Create a new document review
 */
export async function createReview(params: CreateReviewParams): Promise<{ review: DocumentReview }> {
  return apiPost<{ review: DocumentReview }>('/api/audit/reviews', params);
}

/**
 * Update an existing document review
 */
export async function updateReview(id: string, params: UpdateReviewParams): Promise<{ review: DocumentReview }> {
  return apiPatch<{ review: DocumentReview }>(`/api/audit/reviews/${id}`, params);
}

/**
 * Delete a document review
 */
export async function deleteReview(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/audit/reviews/${id}`);
}

/**
 * Full audit result types
 */
export interface AuditFinding {
  document_id: string;
  title: string;
  issues: string[];
  severity: 'critical' | 'warning' | 'info';
  auto_review_created: boolean;
}

export interface AuditSummary {
  total_documents: number;
  healthy: number;
  issues_found: number;
  reviews_created: number;
  breakdown: {
    stale: number;
    empty_content: number;
    uncategorised: number;
    stuck_in_draft: number;
    zero_views: number;
  };
}

export interface FullAuditResult {
  summary: AuditSummary;
  findings: AuditFinding[];
  ran_at: string;
}

/**
 * Run a comprehensive full content audit.
 * Scans all documents, identifies issues, and auto-creates reviews.
 */
export async function runFullAudit(): Promise<FullAuditResult> {
  return apiPost<FullAuditResult>('/api/audit/run-full-audit');
}

/**
 * Mark a document as reviewed (touches updated_at, completes pending reviews)
 */
export async function markDocumentReviewed(documentId: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/audit/mark-reviewed/${documentId}`);
}

/**
 * Increment document view count
 */
export async function trackDocumentView(documentId: string): Promise<void> {
  await apiPost(`/api/documents/${documentId}/view`);
}

// ============================================================================
// Audit Schedules
// ============================================================================

export interface AuditSchedule {
  id: string;
  tenant_id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval_value: number;
  day_of_week: number | null;
  day_of_month: number | null;
  hour_of_day: number;
  minute_of_hour: number;
  timezone: string;
  is_active: boolean;
  auto_create_reviews: boolean;
  stale_threshold_days: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CreateScheduleParams {
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval_value?: number;
  day_of_week?: number;
  day_of_month?: number;
  hour_of_day?: number;
  minute_of_hour?: number;
  timezone?: string;
  is_active?: boolean;
  auto_create_reviews?: boolean;
  stale_threshold_days?: number;
}

export interface UpdateScheduleParams {
  name?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  interval_value?: number;
  day_of_week?: number;
  day_of_month?: number;
  hour_of_day?: number;
  minute_of_hour?: number;
  timezone?: string;
  is_active?: boolean;
  auto_create_reviews?: boolean;
  stale_threshold_days?: number;
}

/**
 * Get all audit schedules for the tenant
 */
export async function getAuditSchedules(): Promise<{ schedules: AuditSchedule[] }> {
  return apiGet<{ schedules: AuditSchedule[] }>('/api/audit/schedules');
}

/**
 * Create a new audit schedule
 */
export async function createAuditSchedule(params: CreateScheduleParams): Promise<{ schedule: AuditSchedule }> {
  return apiPost<{ schedule: AuditSchedule }>('/api/audit/schedules', params);
}

/**
 * Update an audit schedule
 */
export async function updateAuditSchedule(id: string, params: UpdateScheduleParams): Promise<{ schedule: AuditSchedule }> {
  return apiPatch<{ schedule: AuditSchedule }>(`/api/audit/schedules/${id}`, params);
}

/**
 * Delete an audit schedule
 */
export async function deleteAuditSchedule(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/audit/schedules/${id}`);
}

// ============================================================================
// Notification Rules
// ============================================================================

export interface NotificationRule {
  id: string;
  tenant_id: string;
  name: string;
  rule_type: 'review_due' | 'review_overdue' | 'stale_content' | 'audit_complete' | 'health_threshold';
  priority_filter: 'low' | 'medium' | 'high' | 'all' | null;
  days_before_due: number | null;
  stale_threshold_days: number | null;
  health_threshold_percentage: number | null;
  notify_via_email: boolean;
  notify_via_in_app: boolean;
  notify_users: string[];
  notify_roles: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface CreateNotificationRuleParams {
  name: string;
  rule_type: 'review_due' | 'review_overdue' | 'stale_content' | 'audit_complete' | 'health_threshold';
  priority_filter?: 'low' | 'medium' | 'high' | 'all';
  days_before_due?: number;
  stale_threshold_days?: number;
  health_threshold_percentage?: number;
  notify_via_email?: boolean;
  notify_via_in_app?: boolean;
  notify_users?: string[];
  notify_roles?: string[];
  is_active?: boolean;
}

export interface UpdateNotificationRuleParams {
  name?: string;
  rule_type?: 'review_due' | 'review_overdue' | 'stale_content' | 'audit_complete' | 'health_threshold';
  priority_filter?: 'low' | 'medium' | 'high' | 'all';
  days_before_due?: number;
  stale_threshold_days?: number;
  health_threshold_percentage?: number;
  notify_via_email?: boolean;
  notify_via_in_app?: boolean;
  notify_users?: string[];
  notify_roles?: string[];
  is_active?: boolean;
}

/**
 * Get all notification rules for the tenant
 */
export async function getNotificationRules(): Promise<{ rules: NotificationRule[] }> {
  return apiGet<{ rules: NotificationRule[] }>('/api/audit/notification-rules');
}

/**
 * Create a new notification rule
 */
export async function createNotificationRule(params: CreateNotificationRuleParams): Promise<{ rule: NotificationRule }> {
  return apiPost<{ rule: NotificationRule }>('/api/audit/notification-rules', params);
}

/**
 * Update a notification rule
 */
export async function updateNotificationRule(id: string, params: UpdateNotificationRuleParams): Promise<{ rule: NotificationRule }> {
  return apiPatch<{ rule: NotificationRule }>(`/api/audit/notification-rules/${id}`, params);
}

/**
 * Delete a notification rule
 */
export async function deleteNotificationRule(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/audit/notification-rules/${id}`);
}
