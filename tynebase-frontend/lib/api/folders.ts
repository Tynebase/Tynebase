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
  sort_order: number;
  document_count: number;
  subcategory_count: number;
  author_id: string;
  is_system?: boolean;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
  subcategories?: { id: string; name: string; color: string; icon: string }[];
}

export interface CategoryDocument {
  id: string;
  title: string;
  content: string;
  status: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface CategoryWithDocuments {
  category: {
    id: string;
    name: string;
    is_system?: boolean;
  };
  documents: CategoryDocument[];
  count: number;
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
  parent_id?: string | null;
  sort_order?: number;
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
 * Get all documents in a category
 * 
 * @param id - Category UUID
 * @returns Category details with documents
 */
export async function getCategoryDocuments(id: string): Promise<CategoryWithDocuments> {
  return apiGet<CategoryWithDocuments>(`/api/categories/${id}/documents`);
}

/**
 * Get the Uncategorized system category
 * Creates it if it doesn't exist
 * 
 * @returns Uncategorized category details
 */
export async function getUncategorizedCategory(): Promise<{ category: Category }> {
  return apiGet<{ category: Category }>('/api/categories/uncategorized');
}

/**
 * Delete a category with optional document migration
 * 
 * @param id - Category UUID
 * @param migrateToCategoryId - Optional target category ID to migrate documents to (null for Uncategorized)
 * @returns Deletion result with migration details
 */
export interface DeleteCategoryResult {
  message: string;
  categoryId: string;
  categoryName: string;
  migrated: {
    documents: number;
    subcategories: number;
    toCategory: {
      id: string;
      name: string;
      is_system?: boolean;
    } | null;
  };
}

export async function deleteCategory(
  id: string, 
  migrateToCategoryId?: string | null
): Promise<DeleteCategoryResult> {
  const queryParams = migrateToCategoryId 
    ? `?migrate_to_category_id=${migrateToCategoryId}` 
    : '';
  return apiDelete<DeleteCategoryResult>(`/api/categories/${id}${queryParams}`);
}
