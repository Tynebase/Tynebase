/**
 * Templates API Service Layer
 * 
 * Provides functions for interacting with the backend /api/templates endpoints.
 * Handles template listing, creation, and usage (creating documents from templates).
 */

import { apiGet, apiPost, apiPut, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Template {
  id: string;
  tenant_id: string | null;
  title: string;
  description: string | null;
  content: string;
  category: string | null;
  visibility: 'internal' | 'public';
  is_approved: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface TemplateListParams {
  category?: string;
  visibility?: 'internal' | 'public';
  page?: number;
  limit?: number;
}

export interface CreateTemplateData {
  title: string;
  description?: string;
  content: string;
  category?: string;
  visibility?: 'internal' | 'public';
}

export interface UpdateTemplateData {
  title?: string;
  description?: string | null;
  content?: string;
  category?: string | null;
  visibility?: 'internal' | 'public';
}

export interface TemplateListResponse {
  templates: Template[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface TemplateResponse {
  template: Template;
}

export interface UseTemplateResponse {
  document: {
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
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List available templates (approved global templates + tenant's own templates)
 * 
 * @param params - Query parameters for filtering and pagination
 * @returns List of templates with pagination metadata
 */
export async function listTemplates(
  params?: TemplateListParams
): Promise<TemplateListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.category) {
    queryParams.append('category', params.category);
  }
  
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
  const endpoint = queryString ? `/api/templates?${queryString}` : '/api/templates';
  
  return apiGet<TemplateListResponse>(endpoint);
}

/**
 * Create a new template (admin only)
 * 
 * @param data - Template creation data
 * @returns Created template details
 */
export async function createTemplate(
  data: CreateTemplateData
): Promise<TemplateResponse> {
  return apiPost<TemplateResponse>('/api/templates', data);
}

/**
 * Get a single template by ID
 * 
 * @param templateId - Template UUID
 * @returns Template details including content
 */
export async function getTemplate(
  templateId: string
): Promise<TemplateResponse> {
  return apiGet<TemplateResponse>(`/api/templates/${templateId}`);
}

/**
 * Use a template to create a new document
 * 
 * Creates a new draft document with the template's content.
 * The document will be owned by the current user.
 * 
 * @param templateId - Template UUID
 * @returns Created document details
 */
export async function useTemplate(
  templateId: string
): Promise<UseTemplateResponse> {
  return apiPost<UseTemplateResponse>(`/api/templates/${templateId}/use`);
}

/**
 * Update an existing template (admin only)
 * 
 * @param templateId - Template UUID
 * @param data - Fields to update
 * @returns Updated template details
 */
export async function updateTemplate(
  templateId: string,
  data: UpdateTemplateData
): Promise<TemplateResponse> {
  return apiPut<TemplateResponse>(`/api/templates/${templateId}`, data);
}

/**
 * Delete a template (admin only)
 * 
 * @param templateId - Template UUID
 */
export async function deleteTemplate(
  templateId: string
): Promise<void> {
  return apiDelete<void>(`/api/templates/${templateId}`);
}

/**
 * List public templates from all tenants (for community shared-documents)
 */
export async function listPublicTemplates(
  params?: { page?: number; limit?: number }
): Promise<TemplateListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page !== undefined) queryParams.append('page', params.page.toString());
  if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/templates/public?${queryString}` : '/api/templates/public';
  return apiGet<TemplateListResponse>(endpoint);
}

/**
 * Clone a public template to the current tenant's templates
 */
export async function cloneTemplate(
  templateId: string
): Promise<TemplateResponse> {
  return apiPost<TemplateResponse>(`/api/templates/${templateId}/clone`);
}
