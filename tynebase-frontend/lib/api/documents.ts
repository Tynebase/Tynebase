/**
 * Documents API Service Layer
 * 
 * Provides functions for interacting with the backend /api/documents endpoints.
 * Handles document CRUD operations, publishing, and normalized content retrieval.
 */

import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DocumentCollection {
  id: string;
  name: string;
  color: string;
}

export interface DocumentTag {
  id: string;
  name: string;
  description: string | null;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  draft_content?: string;
  draft_title?: string;
  has_draft?: boolean;
  draft_updated_at?: string;
  parent_id: string | null;
  category_id: string | null;
  is_public: boolean;
  visibility: 'private' | 'team' | 'public' | 'community';
  status: 'draft' | 'published';
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  view_count?: number;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
  collections?: DocumentCollection[];
  tags?: DocumentTag[];
}

export interface DocumentListParams {
  category_id?: string;
  status?: 'draft' | 'published';
  tag_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateDocumentData {
  title: string;
  content?: string;
  category_id?: string;
  is_public?: boolean;
  visibility?: 'private' | 'team' | 'public' | 'community';
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  yjs_state?: string;
  is_public?: boolean;
  visibility?: 'private' | 'team' | 'public' | 'community';
  status?: 'draft' | 'published';
  category_id?: string | null;
  draft_content?: string;
  draft_title?: string;
  save_as_draft?: boolean;
}

export interface DocumentListResponse {
  success: true;
  data: {
    documents: Document[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

export interface DocumentResponse {
  success: true;
  data: {
    document: Document;
  };
}

export interface DeleteDocumentResponse {
  success: true;
  data: {
    message: string;
    documentId: string;
  };
}

export interface NormalizedContentResponse {
  success: true;
  data: {
    id: string;
    content: string;
  };
}

export interface NormalizedDocument {
  id: string;
  title: string;
  normalizedMd: string;
  status: 'draft' | 'published';
  visibility: 'private' | 'team' | 'public' | 'community';
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedDocumentsListResponse {
  documents: NormalizedDocument[];
  count: number;
}

export interface ImportDocumentResponse {
  job_id: string;
  storage_path: string;
  filename: string;
  file_size: number;
  status: 'queued';
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List documents with optional filtering and pagination
 * 
 * @param params - Query parameters for filtering and pagination
 * @returns List of documents with pagination metadata
 */
export async function listDocuments(
  params?: DocumentListParams
): Promise<{
  documents: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}> {
  const queryParams = new URLSearchParams();
  
  if (params?.category_id) {
    queryParams.append('category_id', params.category_id);
  }
  
  if (params?.status) {
    queryParams.append('status', params.status);
  }
  
  if (params?.tag_id) {
    queryParams.append('tag_id', params.tag_id);
  }
  
  if (params?.search) {
    queryParams.append('search', params.search);
  }
  
  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/documents?${queryString}` : '/api/documents';
  
  return apiGet<{
    documents: Document[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>(endpoint);
}

/**
 * Get a single document by ID
 * 
 * @param id - Document UUID
 * @param skipViewIncrement - If true, don't increment view count (for refetches)
 * @returns Document details
 */
export async function getDocument(id: string, skipViewIncrement?: boolean): Promise<{ document: Document; is_read_only?: boolean }> {
  const queryParams = skipViewIncrement ? '?skip_view_increment=true' : '';
  return apiGet<{ document: Document; is_read_only?: boolean }>(`/api/documents/${id}${queryParams}`);
}

/**
 * Create a new document
 * 
 * @param data - Document creation data
 * @returns Created document details
 */
export async function createDocument(
  data: CreateDocumentData
): Promise<{ document: Document }> {
  return apiPost<{ document: Document }>('/api/documents', data);
}

/**
 * Update an existing document
 * 
 * @param id - Document UUID
 * @param data - Document update data (at least one field required)
 * @returns Updated document details
 */
export async function updateDocument(
  id: string,
  data: UpdateDocumentData
): Promise<{ document: Document }> {
  return apiPatch<{ document: Document }>(`/api/documents/${id}`, data);
}

/**
 * Delete a document
 * 
 * @param id - Document UUID
 * @returns Deletion confirmation
 */
export async function deleteDocument(id: string): Promise<{ message: string; documentId: string }> {
  return apiDelete<{ message: string; documentId: string }>(`/api/documents/${id}`);
}

/**
 * Publish a document (change status from draft to published)
 * For already published documents with draft changes, publishes the draft content
 * 
 * @param id - Document UUID
 * @returns Published document details
 */
export async function publishDocument(id: string, visibility?: 'private' | 'team' | 'public' | 'community'): Promise<{ document: Document }> {
  return apiPost<{ document: Document }>(`/api/documents/${id}/publish`, visibility ? { visibility } : {});
}

/**
 * Discard draft changes for a published document
 * Clears draft_content, draft_title, and has_draft fields
 * 
 * @param id - Document UUID
 * @returns Updated document details
 */
export async function discardDraft(id: string): Promise<{ document: Document }> {
  return apiPost<{ document: Document }>(`/api/documents/${id}/discard-draft`);
}

/**
 * Get normalized markdown content for a document
 * 
 * @param id - Document UUID
 * @returns Document ID and normalized content
 */
export async function getNormalizedContent(
  id: string
): Promise<NormalizedContentResponse> {
  return apiGet<NormalizedContentResponse>(`/api/documents/${id}/normalized`);
}

/**
 * List all documents with their normalized markdown content
 * Used for the RAG normalized markdown viewer
 * 
 * @param limit - Maximum number of documents to return (default: 100)
 * @returns List of normalized documents with their content
 */
export async function listNormalizedDocuments(
  limit?: number
): Promise<NormalizedDocumentsListResponse> {
  const queryParams = new URLSearchParams();
  if (limit !== undefined) {
    queryParams.append('limit', limit.toString());
  }
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/sources/normalized?${queryString}` : '/api/sources/normalized';
  
  return apiGet<NormalizedDocumentsListResponse>(endpoint);
}

/**
 * Import a document from file (PDF, DOCX, MD, TXT)
 * 
 * Uploads a document file and creates a background job for conversion.
 * Supported formats: PDF, DOCX, Markdown, Plain Text (max 50MB)
 * 
 * @param file - Document file to import
 * @returns Job details for tracking import progress
 */
export async function importDocument(file: File): Promise<ImportDocumentResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  return apiUpload<ImportDocumentResponse>('/api/documents/import', formData);
}

// ============================================================================
// DOCUMENT ASSET UPLOAD
// ============================================================================

export interface AssetUploadResponse {
  storage_path: string;
  signed_url: string;
  filename: string;
  file_size: number;
  mimetype: string;
  asset_type: 'image' | 'video';
  expires_in: number;
}

/**
 * Upload an image or video asset for a document
 * 
 * @param documentId - Document UUID to associate the asset with
 * @param file - Image or video file to upload
 * @returns Asset details including signed URL
 */
export async function uploadDocumentAsset(
  documentId: string,
  file: File
): Promise<AssetUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  return apiUpload<AssetUploadResponse>(`/api/documents/${documentId}/upload`, formData);
}

// ============================================================================
// DOCUMENT VIDEO INGESTION
// ============================================================================

export interface EmbeddedVideo {
  url: string;
  type: 'youtube' | 'uploaded';
  storagePath?: string;
  estimatedDurationMinutes?: number;
}

export interface DocumentVideosResponse {
  documentId: string;
  videos: EmbeddedVideo[];
  totalEstimatedCredits: number;
}

export interface VideoIngestionJobResponse {
  job_id: string;
  video_url: string;
  status: 'queued';
  estimated_credits: number;
}

export interface DocumentVideoIngestionResponse {
  documentId: string;
  jobs: VideoIngestionJobResponse[];
  totalCredits: number;
}

/**
 * Detect embedded videos in a document
 * 
 * @param documentId - Document UUID
 * @returns List of embedded videos with estimated credits
 */
export async function detectDocumentVideos(
  documentId: string
): Promise<DocumentVideosResponse> {
  return apiGet<DocumentVideosResponse>(`/api/documents/${documentId}/videos`);
}

/**
 * Ingest all embedded videos in a document
 * Creates transcription jobs for each video and deducts credits
 * 
 * @param documentId - Document UUID
 * @param options - Ingestion options (transcript, summary, article generation)
 * @returns Job details for tracking ingestion progress
 */
export async function ingestDocumentVideos(
  documentId: string,
  options?: {
    generate_transcript?: boolean;
    generate_summary?: boolean;
    generate_article?: boolean;
    ai_model?: 'deepseek' | 'gemini' | 'claude';
  }
): Promise<DocumentVideoIngestionResponse> {
  return apiPost<DocumentVideoIngestionResponse>(
    `/api/documents/${documentId}/videos/ingest`,
    options || { generate_transcript: true }
  );
}

// ============================================================================
// DOCUMENT SHARING
// ============================================================================

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_with: string | null;
  permission: 'view' | 'edit';
  share_token: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  shared_user?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

export interface ShareListResponse {
  shares: DocumentShare[];
}

export interface ShareLinkResponse {
  share: DocumentShare;
  share_url: string;
}

export interface CreateShareLinkData {
  permission?: 'view' | 'edit';
  expires_in_days?: number;
}

export interface CreateUserShareData {
  user_id: string;
  permission?: 'view' | 'edit';
}

/**
 * List all shares for a document
 * 
 * @param documentId - Document UUID
 * @returns List of shares
 */
export async function listDocumentShares(
  documentId: string
): Promise<ShareListResponse> {
  return apiGet<ShareListResponse>(`/api/documents/${documentId}/shares`);
}

/**
 * Generate a share link for a document
 * 
 * @param documentId - Document UUID
 * @param data - Share link options
 * @returns Share details with URL
 */
export async function createShareLink(
  documentId: string,
  data?: CreateShareLinkData
): Promise<ShareLinkResponse> {
  return apiPost<ShareLinkResponse>(`/api/documents/${documentId}/share-link`, data || {});
}

/**
 * Share a document with a specific user
 * 
 * @param documentId - Document UUID
 * @param data - User share data
 * @returns Share details
 */
export async function shareWithUser(
  documentId: string,
  data: CreateUserShareData
): Promise<{ share: DocumentShare; updated?: boolean }> {
  return apiPost<{ share: DocumentShare; updated?: boolean }>(`/api/documents/${documentId}/share`, data);
}

/**
 * Revoke a share
 * 
 * @param documentId - Document UUID
 * @param shareId - Share UUID
 */
export async function revokeShare(
  documentId: string,
  shareId: string
): Promise<void> {
  return apiDelete<void>(`/api/documents/${documentId}/shares/${shareId}`);
}

/**
 * Resolve a share token to get document access
 * 
 * @param token - Share token
 * @returns Document and permission
 */
export async function resolveShareToken(
  token: string
): Promise<{ document: Document; permission: 'view' | 'edit' }> {
  return apiGet<{ document: Document; permission: 'view' | 'edit' }>(`/api/share/${token}`);
}

/**
 * List public documents (community shared documents)
 * 
 * @param params - Query parameters
 * @returns List of public documents
 */
export async function listSharedDocuments(
  params?: { page?: number; limit?: number; category_id?: string }
): Promise<{
  documents: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.category_id) queryParams.append('category_id', params.category_id);
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/documents/shared?${queryString}` : '/api/documents/shared';
  
  return apiGet<{
    documents: Document[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>(endpoint);
}

/**
 * List public documents (no auth required)
 * Returns documents with visibility='public' and status='published'
 * Supports filtering by tenant_id, category_id, tag_id, and search
 */
export async function listPublicDocuments(
  params?: {
    page?: number;
    limit?: number;
    tenant_id?: string;
    category_id?: string;
    tag_id?: string;
    search?: string;
  }
): Promise<{
  documents: (Document & {
    tags?: Array<{ id: string; name: string; description: string | null }>;
    tenants?: { id: string; name: string; subdomain: string };
  })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters: {
    tenants: Array<{ id: string; name: string; subdomain: string }>;
    categories: Array<{ id: string; name: string; color: string }>;
    tags: Array<{ id: string; name: string; description: string | null }>;
  };
}> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.tenant_id) queryParams.append('tenant_id', params.tenant_id);
  if (params?.category_id) queryParams.append('category_id', params.category_id);
  if (params?.tag_id) queryParams.append('tag_id', params.tag_id);
  if (params?.search) queryParams.append('search', params.search);

  const queryString = queryParams.toString();
  const url = `${baseUrl}/api/public/documents${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Failed to fetch public documents');
  }

  const data = await response.json();
  // Backend wraps in { success, data }
  return data.data || data;
}

/**
 * Get a public document (no auth required)
 * Only works for documents with visibility='public' and status='published'
 */
export async function getPublicDocument(id: string): Promise<{ document: Document }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const response = await fetch(`${baseUrl}/api/public/documents/${id}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Document not found or not public');
  }
  
  return response.json();
}
