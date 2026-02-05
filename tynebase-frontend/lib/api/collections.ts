/**
 * Collections API Service Layer
 * 
 * Provides functions for interacting with the backend /api/collections endpoints.
 * Collections allow users to curate documents into structured groups with access control.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  color: string;
  visibility: 'public' | 'team' | 'private';
  author_id: string;
  sort_order: number;
  document_count: number;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
  documents?: CollectionDocument[];
}

export interface CollectionDocument {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
  added_at: string;
}

export interface CollectionListParams {
  visibility?: 'public' | 'team' | 'private';
  page?: number;
  limit?: number;
}

export interface CreateCollectionData {
  name: string;
  description?: string;
  cover_image_url?: string;
  color?: string;
  visibility?: 'public' | 'team' | 'private';
}

export interface UpdateCollectionData {
  name?: string;
  description?: string;
  cover_image_url?: string | null;
  color?: string;
  visibility?: 'public' | 'team' | 'private';
}

export interface CollectionMember {
  id: string;
  role: 'viewer' | 'editor';
  added_at: string;
  invited_by: string;
  users: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface InviteMemberData {
  user_id: string;
  role?: 'viewer' | 'editor';
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List all collections the user can access
 */
export async function listCollections(
  params?: CollectionListParams
): Promise<{
  collections: Collection[];
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
  
  if (params?.visibility) {
    queryParams.append('visibility', params.visibility);
  }
  
  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/collections?${queryString}` : '/api/collections';
  
  return apiGet<{
    collections: Collection[];
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
 * Get a single collection by ID with its documents
 */
export async function getCollection(id: string): Promise<{ collection: Collection }> {
  return apiGet<{ collection: Collection }>(`/api/collections/${id}`);
}

/**
 * Create a new collection
 */
export async function createCollection(
  data: CreateCollectionData
): Promise<{ collection: Collection }> {
  return apiPost<{ collection: Collection }>('/api/collections', data);
}

/**
 * Update an existing collection
 */
export async function updateCollection(
  id: string,
  data: UpdateCollectionData
): Promise<{ collection: Collection }> {
  return apiPatch<{ collection: Collection }>(`/api/collections/${id}`, data);
}

/**
 * Delete a collection
 */
export async function deleteCollection(id: string): Promise<{ message: string; collectionId: string }> {
  return apiDelete<{ message: string; collectionId: string }>(`/api/collections/${id}`);
}

/**
 * Add documents to a collection
 */
export async function addDocumentsToCollection(
  collectionId: string,
  documentIds: string[]
): Promise<{ message: string; added_count: number }> {
  return apiPost<{ message: string; added_count: number }>(
    `/api/collections/${collectionId}/documents`,
    { document_ids: documentIds }
  );
}

/**
 * Remove a document from a collection
 */
export async function removeDocumentFromCollection(
  collectionId: string,
  documentId: string
): Promise<{ message: string; collectionId: string; documentId: string }> {
  return apiDelete<{ message: string; collectionId: string; documentId: string }>(
    `/api/collections/${collectionId}/documents/${documentId}`
  );
}

// ============================================================================
// COLLECTION MEMBER MANAGEMENT
// ============================================================================

/**
 * Get all members of a collection
 */
export async function getCollectionMembers(
  collectionId: string
): Promise<{ members: CollectionMember[] }> {
  return apiGet<{ members: CollectionMember[] }>(`/api/collections/${collectionId}/members`);
}

/**
 * Invite a member to a private collection
 */
export async function inviteCollectionMember(
  collectionId: string,
  data: InviteMemberData
): Promise<{ member: CollectionMember }> {
  return apiPost<{ member: CollectionMember }>(
    `/api/collections/${collectionId}/members`,
    data
  );
}

/**
 * Remove a member from a collection
 */
export async function removeCollectionMember(
  collectionId: string,
  memberId: string
): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/collections/${collectionId}/members/${memberId}`);
}
