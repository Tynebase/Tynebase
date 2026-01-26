/**
 * Documents API Service Layer
 * 
 * Provides functions for interacting with the backend /api/documents endpoints.
 * Handles document CRUD operations, publishing, and normalized content retrieval.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Document {
  id: string;
  title: string;
  content: string;
  parent_id: string | null;
  is_public: boolean;
  status: 'draft' | 'published';
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface DocumentListParams {
  parent_id?: string;
  status?: 'draft' | 'published';
  page?: number;
  limit?: number;
}

export interface CreateDocumentData {
  title: string;
  content?: string;
  parent_id?: string;
  is_public?: boolean;
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  yjs_state?: string;
  is_public?: boolean;
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
): Promise<DocumentListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.parent_id) {
    queryParams.append('parent_id', params.parent_id);
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
  
  return apiGet<DocumentListResponse>(endpoint);
}

/**
 * Get a single document by ID
 * 
 * @param id - Document UUID
 * @returns Document details
 */
export async function getDocument(id: string): Promise<DocumentResponse> {
  return apiGet<DocumentResponse>(`/api/documents/${id}`);
}

/**
 * Create a new document
 * 
 * @param data - Document creation data
 * @returns Created document details
 */
export async function createDocument(
  data: CreateDocumentData
): Promise<DocumentResponse> {
  return apiPost<DocumentResponse>('/api/documents', data);
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
): Promise<DocumentResponse> {
  return apiPatch<DocumentResponse>(`/api/documents/${id}`, data);
}

/**
 * Delete a document
 * 
 * @param id - Document UUID
 * @returns Deletion confirmation
 */
export async function deleteDocument(id: string): Promise<DeleteDocumentResponse> {
  return apiDelete<DeleteDocumentResponse>(`/api/documents/${id}`);
}

/**
 * Publish a document (change status from draft to published)
 * 
 * @param id - Document UUID
 * @returns Published document details
 */
export async function publishDocument(id: string): Promise<DocumentResponse> {
  return apiPost<DocumentResponse>(`/api/documents/${id}/publish`);
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
