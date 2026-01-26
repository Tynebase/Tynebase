/**
 * Settings & GDPR API Service Layer
 * 
 * Provides functions for interacting with backend settings and GDPR endpoints including:
 * - User consent management (GDPR compliance)
 * - Tenant settings updates
 * - Data export (right to data portability)
 * - Account deletion (right to be forgotten)
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UserConsents {
  ai_processing: boolean;
  analytics_tracking: boolean;
  knowledge_indexing: boolean;
  updated_at: string | null;
}

export interface UpdateConsentsData {
  ai_processing?: boolean;
  analytics_tracking?: boolean;
  knowledge_indexing?: boolean;
}

export interface ConsentsResponse {
  consents: UserConsents;
  note?: string;
}

export interface UpdateConsentsResponse {
  message: string;
  consents: UserConsents;
  note?: string;
}

export interface TenantSettings {
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    company_name?: string;
  };
  ai_preferences?: {
    default_provider?: 'openai' | 'anthropic' | 'cohere';
    default_model?: string;
    temperature?: number;
  };
  notifications?: {
    email_enabled?: boolean;
    digest_frequency?: 'daily' | 'weekly' | 'never';
  };
}

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

export interface UpdateTenantData {
  name?: string;
  settings?: Partial<TenantSettings>;
}

export interface TenantResponse {
  success: true;
  data: {
    tenant: Tenant;
  };
}

export interface ExportDataResponse {
  export_metadata: {
    export_date: string;
    export_format: string;
    gdpr_compliance: string;
    user_id: string;
  };
  user_profile: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    status: string;
    last_active_at: string | null;
    account_created_at: string;
    account_updated_at: string;
  };
  tenant_information: {
    id: string;
    subdomain: string;
    name: string;
    tier: string;
    joined_at: string;
  };
  documents: {
    total_count: number;
    items: Array<Record<string, unknown>>;
  };
  templates: {
    total_count: number;
    items: Array<Record<string, unknown>>;
  };
  usage_history: {
    total_queries: number;
    total_credits_used: number;
    total_tokens_input: number;
    total_tokens_output: number;
    queries: Array<Record<string, unknown>>;
    note?: string;
  };
  audit_trail: {
    export_requested_by: string;
    export_requested_at: string;
    export_ip_address: string;
    export_user_agent: string;
  };
}

export interface DeleteAccountRequest {
  confirmation_token: string;
}

export interface DeleteAccountResponse {
  message: string;
  status: string;
  job_id: string;
  details: {
    user_marked_deleted: boolean;
    deletion_job_queued: boolean;
    estimated_completion: string;
  };
  note: string;
}

// ============================================================================
// CONSENT MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get current user consent preferences
 * 
 * Retrieves the user's GDPR consent settings for AI processing,
 * analytics tracking, and knowledge indexing.
 * 
 * @returns User consent preferences
 */
export async function getConsents(): Promise<ConsentsResponse> {
  return apiGet<ConsentsResponse>('/api/user/consents');
}

/**
 * Update user consent preferences
 * 
 * Updates one or more consent preferences. All consent changes
 * are logged to the audit trail for GDPR compliance.
 * 
 * @param data - Consent updates (at least one field required)
 * @returns Updated consent preferences
 */
export async function updateConsents(
  data: UpdateConsentsData
): Promise<UpdateConsentsResponse> {
  return apiPatch<UpdateConsentsResponse>('/api/user/consents', data);
}

// ============================================================================
// TENANT SETTINGS FUNCTIONS
// ============================================================================

/**
 * Update tenant settings
 * 
 * Updates tenant name and/or settings (branding, AI preferences, notifications).
 * Requires admin role. Settings are merged with existing values.
 * 
 * @param tenantId - Tenant UUID
 * @param data - Tenant update data (name and/or settings)
 * @returns Updated tenant details
 */
export async function updateTenant(
  tenantId: string,
  data: UpdateTenantData
): Promise<TenantResponse> {
  return apiPatch<TenantResponse>(`/api/tenants/${tenantId}`, data);
}

// ============================================================================
// GDPR DATA EXPORT FUNCTIONS
// ============================================================================

/**
 * Export all user data (GDPR Right to Data Portability)
 * 
 * Exports all user data in JSON format including:
 * - User profile information
 * - All documents created by the user
 * - Usage history (AI queries, credits charged)
 * - Templates created by the user
 * - Audit trail metadata
 * 
 * The response will trigger a file download in the browser.
 * 
 * @returns Complete user data export
 */
export async function exportData(): Promise<ExportDataResponse> {
  return apiGet<ExportDataResponse>('/api/gdpr/export');
}

/**
 * Download user data export as a file
 * 
 * Convenience function that fetches the export and triggers
 * a browser download with proper filename.
 * 
 * @returns Promise that resolves when download is initiated
 */
export async function downloadDataExport(): Promise<void> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gdpr/export`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to export data');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // Extract filename from Content-Disposition header or use default
  const contentDisposition = response.headers.get('Content-Disposition');
  const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
  const filename = filenameMatch?.[1] || `tynebase-data-export-${Date.now()}.json`;
  
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ============================================================================
// ACCOUNT DELETION FUNCTIONS
// ============================================================================

/**
 * Delete user account (GDPR Right to be Forgotten)
 * 
 * Initiates the account deletion process. This is irreversible.
 * 
 * Process:
 * 1. User account is immediately marked as deleted
 * 2. Background job is queued to anonymize/remove all user data
 * 3. Data will be anonymized/removed within 24 hours
 * 
 * @param confirmationToken - User ID as confirmation (prevents accidental deletion)
 * @returns Deletion status and job details
 */
export async function deleteAccount(
  confirmationToken: string
): Promise<DeleteAccountResponse> {
  const { apiClient } = await import('./client');
  return apiClient<DeleteAccountResponse>('/api/gdpr/delete-account', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation_token: confirmationToken }),
  });
}
