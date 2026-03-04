import { apiPatch, apiGet, apiPost } from './client';
import type { Tenant, TenantSettings } from '@/types/api';

export interface UpdateTenantRequest {
  name?: string;
  settings?: TenantSettings;
}

export interface UpdateTenantResponse {
  tenant: Tenant;
}

/**
 * Update tenant settings (name, branding, AI preferences)
 * Requires admin role
 * 
 * @param tenantId - Tenant UUID
 * @param data - Tenant update data (name and/or settings)
 * @returns Updated tenant details
 */
export async function updateTenant(
  tenantId: string,
  data: UpdateTenantRequest
): Promise<UpdateTenantResponse> {
  const response = await apiPatch<UpdateTenantResponse>(
    `/api/tenants/${tenantId}`,
    data
  );
  return response;
}

export async function getTenant(tenantId: string): Promise<{ tenant: Tenant }> {
  const response = await apiGet<{ tenant: Tenant }>(
    `/api/tenants/${tenantId}`
  );
  return response;
}

/**
 * Upgrade tenant tier (mock - no payment required)
 * Requires admin role
 */
export async function upgradeTenantTier(
  targetTier: 'base' | 'pro' | 'enterprise'
): Promise<{ message: string; tenant: Tenant }> {
  return apiPost<{ message: string; tenant: Tenant }>(
    '/api/tenants/upgrade',
    { target_tier: targetTier }
  );
}
