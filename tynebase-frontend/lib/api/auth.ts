/**
 * Authentication API Service Layer
 * 
 * Handles all authentication-related API calls to the backend.
 * Manages JWT tokens and tenant context in localStorage.
 */

import {
  apiPost,
  apiGet,
  setAuthTokens,
  setTenantSubdomain,
  clearAuth,
} from './client';
import type {
  SignupRequest,
  LoginRequest,
  AuthResponse,
  MeResponse,
} from '../../types/api';

/**
 * Sign up a new user and create a new tenant
 * 
 * @param data - Signup request data (email, password, tenant info)
 * @returns Auth response with user, tenant, and tokens
 */
export async function signup(data: SignupRequest): Promise<AuthResponse> {
  const response = await apiPost<AuthResponse>('/api/auth/signup', data);
  
  // Store tokens and tenant subdomain
  setAuthTokens(response.access_token, response.refresh_token);
  setTenantSubdomain(response.tenant.subdomain);
  
  return response;
}

/**
 * Log in an existing user
 * 
 * @param data - Login credentials (email, password)
 * @returns Auth response with user, tenant, and tokens
 */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiPost<AuthResponse>('/api/auth/login', data);
  
  // Store tokens and tenant subdomain
  setAuthTokens(response.access_token, response.refresh_token);
  setTenantSubdomain(response.tenant.subdomain);
  
  return response;
}

/**
 * Get current authenticated user and tenant information
 * 
 * @returns Current user and tenant data
 */
export async function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>('/api/auth/me');
}

/**
 * Log out the current user
 * Clears all authentication data from localStorage and redirects to login
 */
export async function logout(): Promise<void> {
  // Clear auth data
  clearAuth();
  
  // Redirect to login page
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

/**
 * Check if user is authenticated
 * 
 * @returns True if access token exists in localStorage
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('access_token');
}

/**
 * Get stored access token
 * 
 * @returns Access token or null if not found
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * Get stored refresh token
 * 
 * @returns Refresh token or null if not found
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

/**
 * Get stored tenant subdomain
 * 
 * @returns Tenant subdomain or null if not found
 */
export function getTenantSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_subdomain');
}
