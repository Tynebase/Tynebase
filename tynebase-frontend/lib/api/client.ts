/**
 * Backend API Client Configuration
 * 
 * Provides a centralized HTTP client for communicating with the TyneBase backend API.
 * Handles authentication, tenant context, error handling, and response parsing.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

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
 * Get the stored JWT access token from localStorage or Cookies (subdomain sync)
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  const localStorageToken = localStorage.getItem('access_token');
  if (localStorageToken) return localStorageToken;
  
  // Fallback to cookie (for cross-subdomain landing)
  const match = document.cookie.match(/(^|;)\s*access_token\s*=\s*([^;]+)/);
  const cookieToken = match ? decodeURIComponent(match[2]) : null;
  
  // Seed localStorage if found in cookie
  if (cookieToken) {
    localStorage.setItem('access_token', cookieToken);
    console.log('[ApiClient] Seeded access_token from cookie');
  }
  
  return cookieToken;
}

/**
 * Get the stored refresh token from localStorage or Cookies
 */
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  const localStorageToken = localStorage.getItem('refresh_token');
  if (localStorageToken) return localStorageToken;
  
  const match = document.cookie.match(/(^|;)\s*refresh_token\s*=\s*([^;]+)/);
  const cookieToken = match ? decodeURIComponent(match[2]) : null;
  
  if (cookieToken) {
    localStorage.setItem('refresh_token', cookieToken);
    console.log('[ApiClient] Seeded refresh_token from cookie');
  }
  
  return cookieToken;
}

/**
 * Decode JWT token to get expiration time
 */
function decodeToken(token: string): { exp?: number } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired or will expire soon (within 5 minutes)
 */
function isTokenExpiringSoon(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  const expirationTime = decoded.exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  return expirationTime - currentTime < fiveMinutes;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    return null;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const responseData = await response.json();
    
    // Backend wraps responses in { success, data: {...} } format
    const data = responseData?.data || responseData;
    
    if (data.access_token && data.refresh_token) {
      setAuthTokens(data.access_token, data.refresh_token);
      return data.access_token;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the active tenant subdomain.
 * Priority: URL subdomain > localStorage (fallback for bare-domain / localhost).
 * The URL is the source of truth — if the user is on dang.tynebase.com the
 * tenant MUST be "dang", regardless of what localStorage says.
 */
function getTenantSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  
  // 1. URL subdomain is the authoritative source
  const { getCurrentSubdomain } = require('@/lib/utils');
  const urlSubdomain = getCurrentSubdomain();
  
  if (urlSubdomain && urlSubdomain !== 'www' && urlSubdomain !== 'main' && urlSubdomain !== 'app') {
    // Sync localStorage so subsequent bare-domain requests use this too
    const stored = localStorage.getItem('tenant_subdomain');
    if (stored !== urlSubdomain) {
      localStorage.setItem('tenant_subdomain', urlSubdomain);
    }
    return urlSubdomain;
  }
  
  // 2. Fallback to localStorage (for bare-domain or localhost access)
  const stored = localStorage.getItem('tenant_subdomain');
  if (stored && stored !== 'main' && stored !== 'www' && stored !== 'app') return stored;
  
  return null;
}

/**
 * Store JWT tokens in localStorage and cookies
 * Cookies are used for server-side middleware access
 */
export function setAuthTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  
  // Store in localStorage for client-side access
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  
  // Store in cookies for server-side middleware access
  // Set secure flags and expiration (7 days for access token, 30 days for refresh)
  const accessExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const cookieDomain = !isLocalhost ? `domain=.${baseDomain};` : '';

  document.cookie = `access_token=${accessToken}; path=/; ${cookieDomain} expires=${accessExpiry.toUTCString()}; SameSite=Lax`;
  document.cookie = `refresh_token=${refreshToken}; path=/; ${cookieDomain} expires=${refreshExpiry.toUTCString()}; SameSite=Lax`;
}

/**
 * Store tenant subdomain in localStorage and cookies
 */
export function setTenantSubdomain(subdomain: string): void {
  if (typeof window === 'undefined') return;
  
  // Store in localStorage
  localStorage.setItem('tenant_subdomain', subdomain);
  
  // Store in cookie for server-side access
  const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
  
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const cookieDomain = !isLocalhost ? `domain=.${baseDomain};` : '';

  document.cookie = `tenant_subdomain=${subdomain}; path=/; ${cookieDomain} expires=${expiry.toUTCString()}; SameSite=Lax`;
}

/**
 * Clear all authentication data from localStorage and cookies
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  
  // Clear localStorage
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('tenant_subdomain');
  
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const cookieDomain = !isLocalhost ? `domain=.${baseDomain};` : '';

  // Clear cookies by setting expired date
  document.cookie = `access_token=; path=/; ${cookieDomain} expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = `refresh_token=; path=/; ${cookieDomain} expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = `tenant_subdomain=; path=/; ${cookieDomain} expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  
  // As a fallback, try to clear them without the domain as well, in case they were set locally directly on the subdomain
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'tenant_subdomain=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
  options?: RequestInit & { skipAutoRedirect?: boolean }
): Promise<T> {
  let token = getAccessToken();
  const tenant = getTenantSubdomain();
  const skipAutoRedirect = options?.skipAutoRedirect || false;
  
  // Check if token needs refresh before making request
  if (token && isTokenExpiringSoon(token)) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      
      if (newToken) {
        token = newToken;
        onRefreshed(newToken);
      } else {
        // Refresh failed, clear auth and redirect
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new ApiClientError({
          message: 'Session expired. Please log in again.',
          statusCode: 401,
        });
      }
    } else {
      // Wait for the ongoing refresh to complete
      token = await new Promise<string>((resolve) => {
        addRefreshSubscriber((newToken: string) => {
          resolve(newToken);
        });
      });
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Merge any provided headers
  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

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
      } catch (parseError) {
        // If response is not JSON, use status text
        console.warn('Failed to parse error response as JSON:', parseError);
        errorData = {
          message: response.statusText || 'An error occurred',
          statusCode: response.status,
        };
      }

      // Handle 401 Unauthorized - try to refresh token once
      if (response.status === 401 && !skipAutoRedirect) {
        // SPECIAL CASE: If the profile is missing (User exists in Supabase but not in this Tenant)
        // do NOT clear auth. This allows the user to stay "soft-logged in" while joining.
        if (errorData.code === 'PROFILE_NOT_FOUND') {
          console.log('[ApiClient] Profile not found for this tenant, but Supabase session is valid. Staying as guest.');
          throw new ApiClientError(errorData);
        }

        // Try refreshing the token
        if (!isRefreshing) {
          isRefreshing = true;
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          
          if (newToken) {
            onRefreshed(newToken);
            // Retry the original request with new token
            return apiClient<T>(endpoint, options);
          }
        }
        
        // Refresh failed or already refreshing, clear auth and redirect
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
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      throw new ApiClientError({
        message: 'Invalid response format from server',
        statusCode: response.status,
      });
    }
    
    // Backend wraps responses in { success, data: {...} } format
    // Unwrap the data property if present for consistent frontend usage
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return data.data as T;
    }
    
    return data as T;
  } catch (error) {
    // Re-throw ApiClientError as-is
    if (error instanceof ApiClientError) {
      throw error;
    }

    // Wrap other errors (network errors, etc.)
    const isNetworkError = error instanceof TypeError && (error.message === 'Failed to fetch' || error.message.includes('fetch'));
    throw new ApiClientError({
      message: isNetworkError
        ? 'Unable to connect to the server. Please check your internet connection and try again.'
        : (error instanceof Error ? error.message : 'Network error occurred'),
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
  body?: unknown,
  options?: { skipAutoRedirect?: boolean }
): Promise<T> {
  return apiClient<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    ...options,
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

      // Handle 401 Unauthorized in upload - try to refresh token once
      if (response.status === 401) {
        // Try refreshing the token
        if (!isRefreshing) {
          isRefreshing = true;
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          
          if (newToken) {
            onRefreshed(newToken);
            // Retry the upload with new token
            return apiUpload<T>(endpoint, formData);
          }
        }
        
        // Refresh failed or already refreshing, clear auth and redirect
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
    
    // Backend wraps responses in { success, data: {...} } format
    // Unwrap the data property if present for consistent frontend usage
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return data.data as T;
    }
    
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
