/**
 * Super Admin API Service Layer
 * 
 * Provides functions for platform-wide admin operations:
 * KPIs, user management, tenant management, impersonation
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface PlatformKPIs {
  totalTenants: number;
  totalUsers: number;
  activeUsers7d: number;
  totalDocuments: number;
  newUsersLast30d: number;
  newDocsLast30d: number;
  aiQueriesLast30d: number;
  totalCreditsUsed: number;
  totalCreditsAllocated: number;
  creditUtilization: number;
}

export interface PlatformUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  tenant_id: string;
  is_super_admin: boolean;
  created_at: string;
  last_active_at: string | null;
  tenant_name: string;
  tenant_subdomain: string;
}

export interface TenantListItem {
  id: string;
  subdomain: string;
  name: string;
  tier: string;
  status: string;
  userCount: number;
  documentCount: number;
  creditsUsed: number;
  creditsTotal: number;
  lastActive: string | null;
  createdAt: string;
}

export interface ImpersonationResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: string;
  tenant: {
    id: string;
    subdomain: string;
    name: string;
    tier: string;
  };
  impersonated_user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
}

// ============================================================================
// KPIs
// ============================================================================

export async function getKPIs(): Promise<PlatformKPIs> {
  const response = await apiGet<{ data: PlatformKPIs }>('/api/superadmin/kpis');
  return (response as any).data || response;
}

// ============================================================================
// USERS
// ============================================================================

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'suspended' | 'all';
  filter?: 'new30d' | 'active7d';
}

export interface ListUsersResponse {
  users: PlatformUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listAllUsers(params: ListUsersParams = {}): Promise<ListUsersResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.search) searchParams.append('search', params.search);
  if (params.status) searchParams.append('status', params.status);
  if (params.filter) searchParams.append('filter', params.filter);

  const qs = searchParams.toString();
  const response = await apiGet<{ data: ListUsersResponse }>(`/api/superadmin/users${qs ? `?${qs}` : ''}`);
  return (response as any).data || response;
}

export async function deleteUser(userId: string): Promise<{ message: string }> {
  const response = await apiDelete<{ message: string }>(`/api/superadmin/users/${userId}`);
  return response;
}

export async function restoreUser(userId: string): Promise<{ message: string }> {
  const response = await apiPost<{ message: string }>(`/api/superadmin/users/${userId}/restore`);
  return response;
}

export async function sendRecoveryEmail(userId: string): Promise<{ message: string }> {
  const response = await apiPost<{ message: string }>(`/api/superadmin/users/${userId}/recovery`);
  return response;
}

export async function assignCredits(userId: string, credits: number): Promise<{ message: string; data: { total_credits: number; used_credits: number } }> {
  const response = await apiPost<{ message: string; data: { total_credits: number; used_credits: number } }>(
    `/api/superadmin/users/${userId}/credits`,
    { credits }
  );
  return response;
}

// ============================================================================
// TENANTS
// ============================================================================

export interface ListTenantsParams {
  page?: number;
  limit?: number;
}

export interface ListTenantsResponse {
  tenants: TenantListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listAllTenants(params: ListTenantsParams = {}): Promise<ListTenantsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());

  const qs = searchParams.toString();
  const response = await apiGet<{ data: ListTenantsResponse }>(`/api/superadmin/tenants${qs ? `?${qs}` : ''}`);
  return (response as any).data || response;
}

// ============================================================================
// IMPERSONATION
// ============================================================================

export async function impersonateTenant(tenantId: string): Promise<ImpersonationResult> {
  const response = await apiPost<{ data: ImpersonationResult }>(`/api/superadmin/impersonate/${tenantId}`);
  return (response as any).data || response;
}

// ============================================================================
// SUSPEND / UNSUSPEND
// ============================================================================

export async function suspendTenant(tenantId: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/superadmin/tenants/${tenantId}/suspend`);
}

export async function unsuspendTenant(tenantId: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/superadmin/tenants/${tenantId}/unsuspend`);
}

export async function deleteTenant(tenantId: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/superadmin/tenants/${tenantId}`);
}

// ============================================================================
// CHANGE TIER
// ============================================================================

export async function changeTenantTier(tenantId: string, tier: string, customCredits?: number): Promise<{ message: string }> {
  return apiPatch<{ message: string }>(`/api/superadmin/tenants/${tenantId}/tier`, { tier, customCredits });
}
