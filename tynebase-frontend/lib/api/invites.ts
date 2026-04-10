/**
 * Invites API Service Layer
 * 
 * Provides functions for inviting users to a tenant.
 */

import { apiPost, apiGet, apiDelete } from './client';

export type WorkspaceRole = 'admin' | 'editor' | 'viewer';

export interface InviteUserRequest {
  email: string;
  role: WorkspaceRole;
}

export interface InviteUserResponse {
  message: string;
  invited_email: string;
  invite_id?: string;
}

/**
 * Invite a user to the tenant
 * 
 * Sends an invitation email to the specified email address.
 * The invited user will receive a link to join the tenant.
 * 
 * @param data - Invite request with email and role
 * @returns Success message
 */
export async function inviteUser(data: InviteUserRequest): Promise<InviteUserResponse> {
  return apiPost<InviteUserResponse>('/api/invites', data);
}

export type AcceptInviteRequest =
  | {
      invite_id: string;
      full_name?: string;
      password?: string;
    }
  | {
      user_id: string;
      tenant_id: string;
      role: WorkspaceRole;
      full_name?: string;
      password?: string;
    };

export interface AcceptInviteResponse {
  message: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
  };
  tenant: {
    id: string;
    subdomain: string;
    name: string;
  };
}

/**
 * Accept an invitation and create user record
 * 
 * Called after clicking the invite link and authenticating.
 * Creates the user record in the users table.
 * 
 * @param data - Accept invite request
 * @returns User and tenant details
 */
export async function acceptInvite(data: AcceptInviteRequest): Promise<AcceptInviteResponse> {
  return apiPost<AcceptInviteResponse>('/api/invites/accept', data);
}

export interface InviteDetailsResponse {
  invite: {
    id: string;
    email: string;
    role: WorkspaceRole;
    invited_by: string;
    created_at: string;
    tenant: {
      id: string;
      name: string;
      subdomain: string;
    };
  };
}

export async function getInvite(inviteId: string): Promise<InviteDetailsResponse> {
  return apiGet<InviteDetailsResponse>(`/api/invites/${inviteId}`);
}

// ============================================================================
// PENDING INVITES
// ============================================================================

export interface PendingInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  created_at: string;
}

export interface PendingInvitesResponse {
  invites: PendingInvite[];
  count: number;
}

/**
 * List pending invitations for the tenant
 * 
 * Returns users who have been invited but haven't accepted yet.
 * Admin only.
 */
export async function listPendingInvites(): Promise<PendingInvitesResponse> {
  return apiGet<PendingInvitesResponse>('/api/invites/pending');
}

/**
 * Cancel a pending invitation
 * 
 * Removes the unconfirmed user. Admin only.
 * 
 * @param inviteId - The ID of the pending invite to cancel
 */
export async function cancelInvite(inviteId: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/invites/${inviteId}`);
}

/**
 * Resend an invitation email
 * 
 * Generates a new magic link and sends it to the invited user. Admin only.
 * 
 * @param inviteId - The ID of the pending invite to resend
 */
export async function resendInvite(inviteId: string): Promise<{ message: string; email: string }> {
  return apiPost<{ message: string; email: string }>(`/api/invites/${inviteId}/resend`, {});
}

/**
 * Decline a pending invitation
 * 
 * Marks the invitation as declined. No authentication required.
 * 
 * @param inviteId - The ID of the pending invite to decline
 */
export async function declineInvite(inviteId: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/invites/${inviteId}/decline`, {}, { skipAutoRedirect: true });
}
