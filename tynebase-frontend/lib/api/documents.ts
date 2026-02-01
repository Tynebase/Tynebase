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
  parent_id: string | null;
  category_id: string | null;
  is_public: boolean;
  visibility: 'private' | 'team' | 'public';
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
  page?: number;
  limit?: number;
}

export interface CreateDocumentData {
  title: string;
  content?: string;
  category_id?: string;
  is_public?: boolean;
  visibility?: 'private' | 'team' | 'public';
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  yjs_state?: string;
  is_public?: boolean;
  visibility?: 'private' | 'team' | 'public';
  status?: 'draft' | 'published';
  category_id?: string | null;
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
  visibility: 'private' | 'team' | 'public';
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
export async function getDocument(id: string, skipViewIncrement?: boolean): Promise<{ document: Document }> {
  const queryParams = skipViewIncrement ? '?skip_view_increment=true' : '';
  return apiGet<{ document: Document }>(`/api/documents/${id}${queryParams}`);
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
 * 
 * @param id - Document UUID
 * @returns Published document details
 */
export async function publishDocument(id: string): Promise<{ document: Document }> {
  return apiPost<{ document: Document }>(`/api/documents/${id}/publish`);
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
