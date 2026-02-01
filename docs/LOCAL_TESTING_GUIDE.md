# TyneBase Local Testing Guide

**Created**: 2026-01-27  
**Phase**: Post 2.5 Integration Testing

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Multi-Tenancy & URL Handling](#multi-tenancy--url-handling)
3. [Critical Issues Found](#critical-issues-found)
4. [Local Development Setup](#local-development-setup)
5. [Testing Scenarios](#testing-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Components
| Component | Port | Technology | Purpose |
|-----------|------|------------|---------|
| Frontend | 3000 | Next.js 15+ | User interface, proxy routing |
| Backend API | 8080 | Fastify | REST API, business logic |
| Collab Server | 8081 | Hocuspocus | Real-time collaboration |
| Supabase | Remote | PostgreSQL + Auth | Database, authentication |

### Request Flow
```
Browser → Next.js Proxy (proxy.ts) → Frontend Pages
                ↓
        Backend API (port 8080)
                ↓
        Supabase (auth + database)
```

---

## Multi-Tenancy & URL Handling

### How It Works

#### Production (tynebase.com)
```
Root Domain:     tynebase.com        → Marketing site
Tenant Subdomain: acme.tynebase.com  → Acme's workspace
Reserved:        www.tynebase.com    → Marketing site
Reserved:        api.tynebase.com    → Reserved (404)
```

#### Subdomain Resolution Flow
1. **proxy.ts** extracts subdomain from hostname using `extractSubdomain()`
2. If no subdomain or "www" → serve root domain (marketing site)
3. If reserved subdomain → rewrite to `/tenant-not-found`
4. If valid tenant subdomain → add `x-tenant-subdomain` header to request

#### Backend Tenant Context
1. **tenantContextMiddleware** reads `x-tenant-subdomain` header
2. Looks up tenant in database (with LRU cache, 5min TTL)
3. Attaches `request.tenant` object for route handlers
4. Routes like `/api/documents` require this header

### Local Development Challenges

**The Problem**: `extractSubdomain()` expects a proper domain structure:
```typescript
// With hostname "acme.tynebase.com" and baseDomain "tynebase.com"
// Returns: "acme"

// With hostname "localhost:3000" and baseDomain "tynebase.com"  
// Returns: null (no subdomain detected!)
```

### Local Testing Solutions

#### Option 1: Modify /etc/hosts (Recommended)
Add to your hosts file:
```
# Windows: C:\Windows\System32\drivers\etc\hosts
# Mac/Linux: /etc/hosts

127.0.0.1   tynebase.local
127.0.0.1   acme.tynebase.local
127.0.0.1   testco.tynebase.local
```

Then set in `.env.local`:
```env
NEXT_PUBLIC_BASE_DOMAIN=tynebase.local
```

Access via: `http://acme.tynebase.local:3000/dashboard`

#### Option 2: Direct API Testing (Bypass Subdomain)
For API testing without subdomain routing:
```bash
# Manually set the x-tenant-subdomain header
curl -X GET http://localhost:8080/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-subdomain: acme"
```

#### Option 3: Localhost with Query Parameter (Future Enhancement)
Could be implemented to support `localhost:3000?tenant=acme`

---

## Issues Found & Fixed

### ✅ Issue 1: Missing `/api/auth/refresh` Endpoint - FIXED

**Location**: `backend/src/routes/auth.ts`

**Problem**: The frontend's `lib/api/client.ts` calls `/api/auth/refresh` to refresh expired tokens, but this endpoint didn't exist.

**Fix Applied**: Added `/api/auth/refresh` endpoint at line 624-680 that:
- Accepts `{ refresh_token }` in request body
- Calls `supabaseAdmin.auth.refreshSession()`
- Returns new `access_token`, `refresh_token`, and `expires_in`

---

### ✅ Issue 2: Signup Doesn't Return Tokens - FIXED

**Location**: `backend/src/routes/auth.ts:177-230`

**Problem**: The signup endpoint created the user but didn't return tokens.

**Fix Applied**: After creating user/tenant, the endpoint now:
- Signs in the newly created user with `signInWithPassword()`
- Returns `access_token`, `refresh_token`, `expires_in` along with user/tenant data
- Handles edge case where sign-in fails (user can manually log in)

---

### ✅ Issue 3: Response Structure Mismatch - FIXED

**Problem**: Backend wraps responses in `{ success, data: {...} }` but frontend expected flat structure.

**Fix Applied**: Updated `tynebase-frontend/lib/api/client.ts`:
- `apiClient()` now unwraps `response.data` automatically (line 318-324)
- `apiUpload()` also unwraps responses (line 470-476)
- `refreshAccessToken()` handles wrapped response (line 115-118)

Frontend code continues to work with flat types like `AuthResponse` while backend maintains its wrapped format.

---

### ✅ Issue 4: Missing NEXT_PUBLIC_BASE_DOMAIN in .env.example - FIXED

**Location**: `tynebase-frontend/.env.example`

**Fix Applied**: Added `NEXT_PUBLIC_BASE_DOMAIN` with documentation (line 30-33).

---

### ✅ Issue 5: getMe Response Structure Mismatch - FIXED

**Problem**: `/api/auth/me` returns wrapped response.

**Fix Applied**: Covered by Issue 3 fix - the API client now automatically unwraps all responses.

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase account with project configured
- Access to Supabase service role key

### Step 1: Clone and Install

```bash
cd C:\Users\Mai\Desktop\TyneBase

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../tynebase-frontend
npm install
```

### Step 2: Configure Environment Variables

#### Backend (`backend/.env`)
```env
# Required
PORT=8080
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Or use new key format
# SUPABASE_SECRET_KEY=sb_secret_...
# SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# CORS - allow frontend
ALLOWED_ORIGINS=http://localhost:3000,http://tynebase.local:3000,http://acme.tynebase.local:3000
```

#### Frontend (`tynebase-frontend/.env.local`)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# API URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8081

# Multi-tenancy (for local testing with /etc/hosts)
NEXT_PUBLIC_BASE_DOMAIN=tynebase.local
```

### Step 3: Setup Local Domains (Recommended)

Edit your hosts file:

**Windows**: `C:\Windows\System32\drivers\etc\hosts` (run Notepad as Admin)
**Mac/Linux**: `/etc/hosts`

Add:
```
127.0.0.1   tynebase.local
127.0.0.1   acme.tynebase.local
127.0.0.1   testco.tynebase.local
```

### Step 4: Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server runs on http://localhost:8080
```

**Terminal 2 - Frontend:**
```bash
cd tynebase-frontend
npm run dev
# Server runs on http://localhost:3000
```

### Step 5: Verify Servers

```bash
# Check backend health
curl http://localhost:8080/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":...,"environment":"development"}
```

---

## Testing Scenarios

### Scenario 1: User Signup Flow

**Goal**: Create a new user and tenant

**Steps**:
1. Navigate to `http://tynebase.local:3000/signup`
2. Select "Company" account type
3. Fill in:
   - Full name: "Test User"
   - Email: "test@example.com"
   - Password: "testpass123"
   - Company name: "Acme Corp"
   - Subdomain: "acme"
4. Click "Create workspace"

**Expected**: 
- ⚠️ Currently fails due to Issue #2 (no tokens returned)
- After fix: Redirects to `/dashboard` with authenticated session

**Verification**:
```bash
# Check if tenant was created in Supabase
# Query tenants table for subdomain = 'acme'
```

---

### Scenario 2: User Login Flow

**Goal**: Login with existing user

**Steps**:
1. Navigate to `http://tynebase.local:3000/login`
2. Enter email and password
3. Click "Sign In"

**Expected**: 
- ⚠️ May fail due to Issue #3 (response structure mismatch)
- After fix: Redirects to `/dashboard`

**Debug**:
```javascript
// In browser console after login attempt
console.log(localStorage.getItem('access_token'));
console.log(localStorage.getItem('tenant_subdomain'));
```

---

### Scenario 3: Protected Route Access

**Goal**: Verify proxy.ts protects dashboard routes

**Steps**:
1. Clear localStorage: `localStorage.clear()`
2. Navigate to `http://tynebase.local:3000/dashboard`

**Expected**: Redirects to `/login?redirect=/dashboard`

---

### Scenario 4: Tenant Subdomain Routing

**Goal**: Verify subdomain isolation

**Steps**:
1. Login as user from tenant "acme"
2. Navigate to `http://acme.tynebase.local:3000/dashboard`
3. Check network requests have `x-tenant-subdomain: acme` header

**Verification**:
```bash
# Backend should receive and log tenant context
# Check backend logs for "Tenant resolved and cached"
```

---

### Scenario 5: API Document Operations

**Goal**: Test CRUD operations with tenant context

**Prerequisite**: Have valid access token

```bash
# Create document
curl -X POST http://localhost:8080/api/documents \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-tenant-subdomain: acme" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Document", "content": "Hello world"}'

# List documents
curl http://localhost:8080/api/documents \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-tenant-subdomain: acme"

# Get single document
curl http://localhost:8080/api/documents/DOCUMENT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-tenant-subdomain: acme"
```

---

### Scenario 6: Reserved Subdomain Handling

**Goal**: Verify reserved subdomains are blocked

**Steps**:
1. Navigate to `http://api.tynebase.local:3000/`
2. Navigate to `http://admin.tynebase.local:3000/`

**Expected**: Both should show tenant-not-found page

---

## Troubleshooting

### "CORS Error" in Browser Console

**Cause**: Backend doesn't allow frontend origin

**Fix**: Add origin to `ALLOWED_ORIGINS` in `backend/.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://tynebase.local:3000
```

---

### "Missing x-tenant-subdomain header" Error

**Cause**: Frontend not sending tenant header, or subdomain extraction failed

**Debug**:
```javascript
// Check if tenant is stored
console.log(localStorage.getItem('tenant_subdomain'));
```

**Fix**: Ensure subdomain is stored after login/signup, or use hosts file for proper subdomain testing.

---

### "MISSING_AUTH_TOKEN" Error

**Cause**: No access token in localStorage/cookie

**Debug**:
```javascript
console.log(localStorage.getItem('access_token'));
console.log(document.cookie);
```

**Fix**: Re-login, or fix Issues #2/#3 if signup/login doesn't store tokens properly.

---

### Subdomain Not Detected on localhost

**Cause**: `extractSubdomain()` can't parse `localhost:3000`

**Fix**: Use hosts file method (Option 1 above) with `tynebase.local` domain.

---

### Backend Won't Start - "Missing environment variables"

**Cause**: Required env vars not set

**Check**:
```bash
cd backend
cat .env | grep SUPABASE
```

**Required**:
- `SUPABASE_URL`
- Either `SUPABASE_SECRET_KEY` + `SUPABASE_PUBLISHABLE_KEY` OR
- `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY`

---

## Quick Reference

### Development URLs

| URL | Purpose |
|-----|---------|
| `http://tynebase.local:3000` | Marketing site (root domain) |
| `http://tynebase.local:3000/login` | Login page |
| `http://tynebase.local:3000/signup` | Signup page |
| `http://acme.tynebase.local:3000/dashboard` | Tenant dashboard |
| `http://localhost:8080/health` | Backend health check |
| `http://localhost:8080/api/documents` | Documents API |

### Key Files

| File | Purpose |
|------|---------|
| `tynebase-frontend/proxy.ts` | Next.js edge proxy (auth, routing) |
| `tynebase-frontend/lib/api/client.ts` | API client with token refresh |
| `tynebase-frontend/lib/api/auth.ts` | Auth API functions |
| `tynebase-frontend/lib/utils.ts` | `extractSubdomain()` helper |
| `backend/src/routes/auth.ts` | Auth endpoints |
| `backend/src/middleware/tenantContext.ts` | Tenant resolution |
| `backend/src/middleware/auth.ts` | JWT validation |

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Frontend | Backend URL (default: `http://localhost:8080`) |
| `NEXT_PUBLIC_BASE_DOMAIN` | Frontend | Domain for subdomain extraction |
| `ALLOWED_ORIGINS` | Backend | CORS whitelist |
| `SUPABASE_URL` | Both | Supabase project URL |

---

## Next Steps

All critical issues have been fixed. You can now:

1. **Set up local environment** - Copy `.env.example` to `.env.local` and configure
2. **Configure hosts file** - Add `tynebase.local` entries for subdomain testing
3. **Start dev servers** - Run backend on port 8080, frontend on port 3000
4. **Run test scenarios** - Verify signup, login, and protected routes work
5. **Create integration tests** - Automated tests for auth flow

