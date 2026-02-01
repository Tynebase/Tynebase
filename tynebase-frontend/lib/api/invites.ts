/**
 * Invites API Service Layer
 * 
 * Provides functions for inviting users to a tenant.
 */

import { apiPost } from './client';

export interface InviteUserRequest {
  email: string;
  role: 'admin' | 'editor' | 'member' | 'viewer';
}

export interface InviteUserResponse {
  message: string;
  invited_email: string;
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

export interface AcceptInviteRequest {
  user_id: string;
  tenant_id: string;
  role: 'admin' | 'editor' | 'member' | 'viewer';
  full_name?: string;
}

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
