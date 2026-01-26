/**
 * Backend API Client Configuration
 * 
 * Provides a centralized HTTP client for communicating with the TyneBase backend API.
 * Handles authentication, tenant context, error handling, and response parsing.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: unknown;
}

export class ApiClientError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.statusCode = error.statusCode || 500;
    this.code = error.code;
    this.details = error.details;
  }
}

/**
 * Get the stored JWT access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * Get the stored tenant subdomain from localStorage
 */
function getTenantSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_subdomain');
}

/**
 * Store JWT tokens in localStorage
 */
export function setAuthTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

/**
 * Store tenant subdomain in localStorage
 */
export function setTenantSubdomain(subdomain: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('tenant_subdomain', subdomain);
}

/**
 * Clear all authentication data from localStorage
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('tenant_subdomain');
}

/**
 * Main API client function
 * 
 * @param endpoint - API endpoint path (e.g., '/api/documents')
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Parsed JSON response
 * @throws ApiClientError on HTTP errors or network failures
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getAccessToken();
  const tenant = getTenantSubdomain();

  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add tenant subdomain header if exists
  if (tenant) {
    headers['x-tenant-subdomain'] = tenant;
  }

  // Build full URL
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle non-OK responses
    if (!response.ok) {
      let errorData: ApiError;

      try {
        const errorJson = await response.json();
        errorData = {
          message: errorJson.error?.message || errorJson.message || 'An error occurred',
          code: errorJson.error?.code || errorJson.code,
          statusCode: response.status,
          details: errorJson.error?.details || errorJson.details,
        };
      } catch {
        // If response is not JSON, use status text
        errorData = {
          message: response.statusText || 'An error occurred',
          statusCode: response.status,
        };
      }

      // Handle 401 Unauthorized - clear auth and redirect to login
      if (response.status === 401) {
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      throw new ApiClientError(errorData);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    // Parse JSON response
    const data = await response.json();
    return data as T;
  } catch (error) {
    // Re-throw ApiClientError as-is
    if (error instanceof ApiClientError) {
      throw error;
    }

    // Wrap other errors (network errors, etc.)
    throw new ApiClientError({
      message: error instanceof Error ? error.message : 'Network error occurred',
      statusCode: 0,
    });
  }
}

/**
 * Convenience method for GET requests
 */
export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: 'GET' });
}

/**
 * Convenience method for POST requests
 */
export async function apiPost<T = unknown>(
  endpoint: string,
  body?: unknown
): Promise<T> {
  return apiClient<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for PATCH requests
 */
export async function apiPatch<T = unknown>(
  endpoint: string,
  body?: unknown
): Promise<T> {
  return apiClient<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for PUT requests
 */
export async function apiPut<T = unknown>(
  endpoint: string,
  body?: unknown
): Promise<T> {
  return apiClient<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for DELETE requests
 */
export async function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: 'DELETE' });
}

/**
 * Upload file with multipart/form-data
 */
export async function apiUpload<T = unknown>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const token = getAccessToken();
  const tenant = getTenantSubdomain();

  // Build headers (don't set Content-Type for FormData - browser will set it with boundary)
  const headers: HeadersInit = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (tenant) {
    headers['x-tenant-subdomain'] = tenant;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorData: ApiError;

      try {
        const errorJson = await response.json();
        errorData = {
          message: errorJson.error?.message || errorJson.message || 'Upload failed',
          code: errorJson.error?.code || errorJson.code,
          statusCode: response.status,
          details: errorJson.error?.details || errorJson.details,
        };
      } catch {
        errorData = {
          message: response.statusText || 'Upload failed',
          statusCode: response.status,
        };
      }

      if (response.status === 401) {
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }

      throw new ApiClientError(errorData);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    throw new ApiClientError({
      message: error instanceof Error ? error.message : 'Upload failed',
      statusCode: 0,
    });
  }
}
