# Token Refresh Implementation

## Overview
Implemented automatic token refresh logic to handle JWT token expiration gracefully without requiring users to log in again.

## Features Implemented

### 1. Automatic Token Refresh Before Expiry
- **Location**: `lib/api/client.ts`
- **Mechanism**: Checks if token will expire within 5 minutes before each API request
- **Action**: Automatically refreshes token using refresh token endpoint
- **Benefit**: Prevents 401 errors for active users

### 2. 401 Error Interceptor with Retry
- **Location**: `lib/api/client.ts` (apiClient and apiUpload functions)
- **Mechanism**: Catches 401 responses and attempts token refresh
- **Action**: Retries original request with new token if refresh succeeds
- **Fallback**: Clears auth and redirects to login if refresh fails

### 3. Concurrent Request Handling
- **Pattern**: Token refresh queue with subscriber pattern
- **Mechanism**: Only one refresh request at a time, other requests wait
- **Benefit**: Prevents multiple simultaneous refresh requests

### 4. Token Expiry Detection
- **Function**: `decodeToken()` and `isTokenExpiringSoon()`
- **Logic**: Decodes JWT payload to check expiration time
- **Threshold**: 5 minutes before actual expiry

## Implementation Details

### Token Refresh Flow
```
1. User makes API request
2. Check if token expires within 5 minutes
3. If yes:
   a. Acquire refresh lock
   b. Call POST /api/auth/refresh with refresh_token
   c. Store new access_token and refresh_token
   d. Release lock and notify waiting requests
   e. Continue with original request using new token
4. If no: Continue with current token
```

### 401 Error Handling Flow
```
1. API request returns 401
2. Check if refresh is already in progress
3. If not:
   a. Attempt token refresh
   b. If successful: Retry original request
   c. If failed: Clear auth and redirect to login
4. If yes: Wait for ongoing refresh, then retry
```

## Testing Instructions

### Manual Test 1: Token Expiry
1. Log in to the application
2. Wait until token is close to expiry (or manually set short expiry in backend)
3. Make an API request (e.g., navigate to documents page)
4. Verify: Request succeeds without login prompt

### Manual Test 2: 401 Recovery
1. Log in to the application
2. Manually invalidate access token in localStorage
3. Make an API request
4. Verify: Token refreshes automatically and request succeeds

### Manual Test 3: Refresh Failure
1. Log in to the application
2. Manually invalidate both access and refresh tokens
3. Make an API request
4. Verify: Redirected to login page

## Files Modified
- `tynebase-frontend/lib/api/client.ts` - Added token refresh logic
- `tynebase-frontend/lib/api/auth.ts` - Added refreshToken() function

## Backend Requirements
The backend must implement:
- `POST /api/auth/refresh` endpoint
- Request body: `{ refresh_token: string }`
- Response: `{ access_token: string, refresh_token: string }`

## Security Considerations
- Refresh tokens are stored in localStorage and httpOnly cookies
- Tokens are only refreshed when needed (5 min threshold)
- Failed refresh attempts immediately clear auth state
- Only one refresh request at a time to prevent token race conditions
