/**
 * TypeScript Type Definitions for TyneBase Backend API
 * 
 * These interfaces match the backend response schemas from the Fastify API.
 * Keep in sync with backend/src/routes/* and database schema.
 */

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface Tenant {
  id: string;
  subdomain: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  settings: TenantSettings;
  storage_limit: number;
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
  };
  ai_provider?: {
    default_text_model?: string;
    default_embedding_model?: string;
    default_video_model?: string;
  };
  features?: {
    collaboration_enabled?: boolean;
    ai_generation_enabled?: boolean;
    rag_chat_enabled?: boolean;
  };
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  role: 'admin' | 'editor' | 'member' | 'viewer';
  is_super_admin: boolean;
  status: 'active' | 'suspended' | 'deleted';
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  content_type: 'tiptap_json' | 'markdown' | 'html';
  status: 'draft' | 'published' | 'archived';
  metadata: DocumentMetadata;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface DocumentMetadata {
  tags?: string[];
  category?: string;
  description?: string;
  word_count?: number;
  reading_time_minutes?: number;
  source?: {
    type?: 'ai_generated' | 'imported' | 'template' | 'manual';
    job_id?: string;
    template_id?: string;
    original_url?: string;
  };
}

export interface Template {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  content: string;
  content_type: 'tiptap_json' | 'markdown' | 'html';
  category: string | null;
  is_public: boolean;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  tenant_id: string;
  type: 'ai_generation' | 'video_transcription' | 'document_import' | 'embedding_generation' | 'document_enhancement';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  progress: number;
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface DocumentEmbedding {
  id: string;
  document_id: string;
  tenant_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserConsent {
  id: string;
  user_id: string;
  tenant_id: string;
  consent_type: 'analytics' | 'marketing' | 'ai_training';
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditPool {
  id: string;
  tenant_id: string;
  total_credits: number;
  used_credits: number;
  reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface QueryUsage {
  id: string;
  tenant_id: string;
  user_id: string;
  operation_type: string;
  credits_used: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// API REQUEST PAYLOADS
// ============================================================================

export interface SignupRequest {
  email: string;
  password: string;
  tenant_name: string;
  subdomain: string;
  full_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateDocumentRequest {
  title: string;
  content?: string;
  content_type?: 'tiptap_json' | 'markdown' | 'html';
  status?: 'draft' | 'published';
  metadata?: DocumentMetadata;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  content_type?: 'tiptap_json' | 'markdown' | 'html';
  status?: 'draft' | 'published' | 'archived';
  metadata?: DocumentMetadata;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  content: string;
  content_type?: 'tiptap_json' | 'markdown' | 'html';
  category?: string;
  is_public?: boolean;
}

export interface AIGenerateRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
}

export interface AIEnhanceRequest {
  document_id: string;
  enhancement_type: 'grammar' | 'clarity' | 'tone' | 'expand' | 'summarize';
  instructions?: string;
}

export interface RAGChatRequest {
  query: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  max_sources?: number;
  model?: string;
}

export interface VideoUploadRequest {
  video_url?: string;
  youtube_url?: string;
  language?: string;
  model?: string;
}

export interface UpdateConsentRequest {
  consent_type: 'analytics' | 'marketing' | 'ai_training';
  granted: boolean;
}

export interface UpdateTenantRequest {
  name?: string;
  settings?: Partial<TenantSettings>;
}

// ============================================================================
// API RESPONSE PAYLOADS
// ============================================================================

export interface AuthResponse {
  user: User;
  tenant: Tenant;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface MeResponse {
  user: User;
  tenant: Tenant;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
}

export interface TemplateListResponse {
  templates: Template[];
  total: number;
}

export interface JobResponse {
  job: Job;
}

export interface JobStatusResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
}

export interface AIGenerateResponse {
  job_id: string;
  status: 'pending' | 'processing';
}

export interface AIEnhanceResponse {
  job_id: string;
  suggestions: Array<{
    id: string;
    type: string;
    original: string;
    suggested: string;
    reason: string;
  }>;
}

export interface RAGChatResponse {
  answer: string;
  sources: Array<{
    document_id: string;
    title: string;
    chunk_text: string;
    relevance_score: number;
  }>;
  model_used: string;
  tokens_used: number;
}

export interface VideoTranscriptResponse {
  job_id: string;
  status: 'pending' | 'processing';
}

export interface SourcesHealthResponse {
  total_documents: number;
  indexed_documents: number;
  pending_documents: number;
  last_index_at: string | null;
  index_health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface GDPRExportResponse {
  export_url: string;
  expires_at: string;
}

export interface ConsentListResponse {
  consents: UserConsent[];
}

export interface CreditStatusResponse {
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  reset_at: string;
}

export interface PlatformStatsResponse {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_documents: number;
  total_ai_queries: number;
}

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// PAGINATION & FILTERS
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface DocumentFilters extends PaginationParams {
  status?: 'draft' | 'published' | 'archived';
  search?: string;
  category?: string;
  created_by?: string;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

export interface TemplateFilters extends PaginationParams {
  category?: string;
  is_public?: boolean;
  search?: string;
}

// ============================================================================
// WEBSOCKET EVENTS (for real-time collaboration)
// ============================================================================

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'cursor_update' | 'selection_update';
  user_id: string;
  user_name: string;
  data?: unknown;
}

export interface CursorPosition {
  user_id: string;
  user_name: string;
  position: number;
  color: string;
}
