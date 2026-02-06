/**
 * Tags API Service Layer
 * 
 * Provides functions for interacting with the backend /api/tags endpoints.
 * Handles tag CRUD operations and document-tag relationships.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Tag {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  document_count: number;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface TagListParams {
  page?: number;
  limit?: number;
}

export interface CreateTagData {
  name: string;
  description?: string;
}

export interface UpdateTagData {
  name?: string;
  description?: string;
  sort_order?: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List all tags for the tenant with pagination
 * 
 * @param params - Query parameters for pagination
 * @returns List of tags with pagination metadata
 */
export async function listTags(
  params?: TagListParams
): Promise<{
  tags: Tag[];
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
  
  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/tags?${queryString}` : '/api/tags';
  
  return apiGet<{
    tags: Tag[];
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
 * Create a new tag
 * 
 * @param data - Tag creation data
 * @returns Created tag details
 */
export async function createTag(
  data: CreateTagData
): Promise<{ tag: Tag }> {
  return apiPost<{ tag: Tag }>('/api/tags', data);
}

/**
 * Update an existing tag
 * 
 * @param id - Tag UUID
 * @param data - Tag update data (at least one field required)
 * @returns Updated tag details
 */
export async function updateTag(
  id: string,
  data: UpdateTagData
): Promise<{ tag: Tag }> {
  return apiPatch<{ tag: Tag }>(`/api/tags/${id}`, data);
}

/**
 * Delete a tag
 * 
 * @param id - Tag UUID
 * @returns Deletion confirmation
 */
export async function deleteTag(id: string): Promise<{ message: string; tagId: string }> {
  return apiDelete<{ message: string; tagId: string }>(`/api/tags/${id}`);
}

/**
 * Add a tag to multiple documents
 * 
 * @param tagId - Tag UUID
 * @param documentIds - Array of document UUIDs
 * @returns Success confirmation
 */
export async function addTagToDocuments(
  tagId: string,
  documentIds: string[]
): Promise<{ message: string; count: number }> {
  return apiPost<{ message: string; count: number }>(`/api/tags/${tagId}/documents`, {
    document_ids: documentIds,
  });
}

/**
 * Reorder tags by updating their sort_order
 * 
 * @param tagIds - Array of tag UUIDs in the desired order
 * @returns Success confirmation
 */
export async function reorderTags(
  tagIds: string[]
): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/api/tags/reorder', {
    tag_ids: tagIds,
  });
}

/**
 * Remove a tag from a document
 * 
 * @param tagId - Tag UUID
 * @param documentId - Document UUID
 * @returns Success confirmation
 */
export async function removeTagFromDocument(
  tagId: string,
  documentId: string
): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/tags/${tagId}/documents/${documentId}`);
}
