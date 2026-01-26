export type UserRole = "super_admin" | "admin" | "editor" | "premium" | "contributor" | "view_only";

export type SubscriptionPlan = "free" | "base" | "pro" | "company";

export type DocumentState = "draft" | "in_review" | "published" | "hidden" | "archived";

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  plan: SubscriptionPlan;
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  secondary_color?: string;
  max_users: number;
  max_storage_mb: number;
  max_ai_generations_per_month: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id?: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole;
  theme?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  tenant_id: string;
  title: string;
  content?: string;
  content_type?: string;
  state: DocumentState;
  category_id?: string;
  author_id?: string;
  assigned_to?: string;
  is_public: boolean;
  normalized_md?: string;
  file_url?: string;
  file_type?: string;
  view_count: number;
  helpful_count: number;
  current_version: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  last_viewed_at?: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content: string;
  content_type: string;
  created_by?: string;
  created_at: string;
}

export interface DocumentEmbedding {
  id: string;
  tenant_id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  chunk_tokens: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Template {
  id: string;
  tenant_id?: string;
  title: string;
  description?: string;
  content: string;
  author_id?: string;
  is_public: boolean;
  is_approved: boolean;
  usage_count: number;
  created_at: string;
}

export interface Discussion {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  author_id?: string;
  is_solved: boolean;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  reply_count: number;
  created_at: string;
}

export interface DiscussionReply {
  id: string;
  discussion_id: string;
  parent_reply_id?: string;
  content: string;
  author_id?: string;
  is_solution: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content?: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface AIGenerationJob {
  id: string;
  tenant_id: string;
  user_id: string;
  job_type: string;
  input_data: Record<string, unknown>;
  status: string;
  progress: number;
  result_document_ids?: string[];
  result_data?: Record<string, unknown>;
  ai_metadata?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ContentAuditReport {
  id: string;
  tenant_id: string;
  generated_by?: string;
  report_data: Record<string, unknown>;
  summary: Record<string, unknown>;
  created_at: string;
}

export interface UserConsent {
  id: string;
  user_id: string;
  purpose: string;
  granted: boolean;
  granted_at?: string;
  withdrawn_at?: string;
  consent_text_version: string;
  created_at: string;
}

export interface TenantBranding {
  primary_color: string;
  secondary_color?: string;
  logo_url?: string;
  favicon_url?: string;
  name: string;
}
