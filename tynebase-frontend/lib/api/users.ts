/**
 * Users API Service Layer
 * 
 * Provides functions for interacting with the backend /api/users endpoints.
 * Handles user listing and team member management.
 */

import { apiGet, apiPatch, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  last_active_at: string | null;
  documents_count: number;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  status?: 'active' | 'suspended' | 'deleted';
  role?: 'admin' | 'editor' | 'viewer';
}

export interface UserListResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UpdateUserParams {
  role?: 'admin' | 'editor' | 'viewer';
  status?: 'active' | 'suspended';
  full_name?: string;
}

export interface UpdateUserResponse {
  user: User;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List users in the tenant with optional filtering and pagination
 */
export async function listUsers(
  params?: UserListParams
): Promise<UserListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  
  if (params?.status) {
    queryParams.append('status', params.status);
  }
  
  if (params?.role) {
    queryParams.append('role', params.role);
  }
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/users?${queryString}` : '/api/users';
  
  return apiGet<UserListResponse>(endpoint);
}

/**
 * Update a user's role, status, or full name
 */
export async function updateUser(
  userId: string,
  params: UpdateUserParams
): Promise<UpdateUserResponse> {
  return apiPatch<UpdateUserResponse>(`/api/users/${userId}`, params);
}

/**
 * Delete (soft delete) a user from the tenant
 */
export async function deleteUser(userId: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/users/${userId}`);
}
