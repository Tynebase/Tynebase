/**
 * Categories API Service Layer
 * 
 * Provides functions for interacting with the backend /api/categories endpoints.
 * Categories are used to organize documents hierarchically.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  parent_id: string | null;
  document_count: number;
  subcategory_count: number;
  author_id: string;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
  subcategories?: { id: string; name: string; color: string; icon: string }[];
}

export interface CategoryListParams {
  parent_id?: string;
  page?: number;
  limit?: number;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  parent_id?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List all categories for the tenant with optional parent filtering
 * 
 * @param params - Query parameters for filtering and pagination
 * @returns List of categories with pagination metadata
 */
export async function listCategories(
  params?: CategoryListParams
): Promise<{
  categories: Category[];
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
  
  if (params?.parent_id) {
    queryParams.append('parent_id', params.parent_id);
  }
  
  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/categories?${queryString}` : '/api/categories';
  
  return apiGet<{
    categories: Category[];
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
 * Get a single category by ID with its subcategories
 * 
 * @param id - Category UUID
 * @returns Category details with subcategories
 */
export async function getCategory(id: string): Promise<{ category: Category }> {
  return apiGet<{ category: Category }>(`/api/categories/${id}`);
}

/**
 * Create a new category
 * 
 * @param data - Category creation data
 * @returns Created category details
 */
export async function createCategory(
  data: CreateCategoryData
): Promise<{ category: Category }> {
  return apiPost<{ category: Category }>('/api/categories', data);
}

/**
 * Update an existing category
 * 
 * @param id - Category UUID
 * @param data - Category update data (at least one field required)
 * @returns Updated category details
 */
export async function updateCategory(
  id: string,
  data: UpdateCategoryData
): Promise<{ category: Category }> {
  return apiPatch<{ category: Category }>(`/api/categories/${id}`, data);
}

/**
 * Delete a category (must be empty)
 * 
 * @param id - Category UUID
 * @returns Deletion confirmation
 */
export async function deleteCategory(id: string): Promise<{ message: string; categoryId: string }> {
  return apiDelete<{ message: string; categoryId: string }>(`/api/categories/${id}`);
}
