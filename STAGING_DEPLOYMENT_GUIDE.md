# TyneBase Staging Deployment Guide

**Purpose**: Deploy Milestone 2 to staging environment (Vercel + Fly.io + Supabase)  
**Status**: Ready for deployment  
**Last Updated**: 2026-02-01

---

## Executive Summary

This guide covers deploying the TyneBase Milestone 2 build to a staging environment:
- **Frontend**: Vercel (Next.js 16)
- **Backend API**: Fly.io (Fastify + RAG)
- **Collaboration Server**: Fly.io (Hocuspocus WebSocket)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Domain**: Client's custom domain with wildcard SSL

**What's Included**:
- Full dashboard with AI assistant, document editor, categories
- RAG-powered AI generation with context awareness
- Real-time collaboration (Hocuspocus Yjs)
- Multi-tenancy with subdomain routing
- Credit system integration
- Document export (PDF, DOCX, MD)

**NOT Included** (Future Milestones):
- Community features (discussions, sharing)
- Payment provider integration
- Advanced analytics

---

## Pre-Deployment Checklist

Before starting deployment, ensure you have:

### Accounts & Access
- [ ] Vercel account with Pro plan (for wildcard domains)
- [ ] Fly.io account
- [ ] Supabase project created
- [ ] Domain registrar access
- [ ] Git repository push access

### Required Files Present
- [ ] `tynebase-frontend/.env.production` - Frontend env template
- [ ] `backend/.env.example` - Backend env template
- [ ] `fly.toml` - Backend API Fly.io config
- [ ] `fly.collab.toml` - Collaboration server Fly.io config
- [ ] `supabase/migrations/` - All 50+ migration files

### Secrets Ready
- [ ] Supabase project URL and API keys
- [ ] Google Cloud service account (Vertex AI for Gemini)
- [ ] Domain name decided (e.g., `staging.tynebase.com`)

---

## Phase 1: Git Push

### 1.1 Final Code Review

```bash
# From project root
cd c:\Users\Mai\Desktop\TyneBase

# Check git status
git status

# Ensure all Milestone 2 features are committed
git log --oneline -10
```

### 1.2 Pre-Push Verification

```bash
# Check for uncommitted changes
git diff --stat

# Verify no sensitive files in commit
git ls-files | grep -E "\.(env|key|pem|p12)$"

# If any found, add to .gitignore before pushing
```

### 1.3 Push to Remote

```bash
# Add remote if not already added (replace with client's repo)
git remote add origin https://github.com/CLIENT/tynebase.git

# Or verify existing remote
git remote -v

# Push to main branch
git push origin main

# Or push to staging branch
git push origin main:staging
```

---

## Phase 2: Supabase Setup

### 2.1 Create Production Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Organization**: Client's org
   - **Project Name**: `tynebase-staging`
   - **Database Password**: Generate strong password (save in 1Password)
   - **Region**: `London (West) EU West 2` (closest to Fly.io LHR)

### 2.2 Get API Keys

1. Go to Project Settings → API
2. Copy these values for later:
   - **Project URL**: `https://xxxx.supabase.co`
   - **Publishable Key**: `sb_publishable_...`
   - **Secret Key**: `sb_secret_...` (click "Reveal" then copy)

### 2.3 Run Migrations

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref xxxx  # replace with project ID from URL

# Push all migrations
supabase db push

# Verify migrations applied
supabase migration list
```

### 2.4 Verify Database Objects

In Supabase Dashboard SQL Editor, run:

```sql
-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should see: ai_generation_jobs, audit_logs, categories, credit_pools, 
-- document_embeddings, document_versions, documents, notifications, 
-- query_usage, templates, tenants, user_consents, users

-- Verify extensions
SELECT * FROM pg_extension WHERE extname IN ('pgvector', 'uuid-ossp');

-- Verify storage buckets
SELECT name FROM storage.buckets;
-- Should see: avatars, documents, logos, videos
```

### 2.5 Configure Auth

1. Go to Authentication → URL Configuration
2. Set **Site URL**: `https://staging.tynebase.com` (or your domain)
3. Add to **Redirect URLs**:
   - `https://staging.tynebase.com/auth/callback`
   - `https://*.staging.tynebase.com/auth/callback` (wildcard for subdomains)

### 2.6 Enable Storage

1. Go to Storage → Policies
2. Verify these buckets exist (create if missing):
   - `avatars` - User profile images
   - `documents` - Uploaded documents
   - `logos` - Tenant logos
   - `videos` - Video uploads for transcription

3. Set bucket policies (Storage → Buckets → [bucket] → Policies):
   - Allow authenticated users to upload/download their own files
   - Allow public read for logos and avatars

---

## Phase 3: Fly.io Backend Deployment

### 3.1 Install Flyctl & Login

```bash
# Windows PowerShell
iwr https://fly.io/install.ps1 -useb | iex

# Verify installation
flyctl version

# Login
flyctl auth login
```

### 3.2 Deploy Backend API

```bash
# From project root
cd c:\Users\Mai\Desktop\TyneBase

# Create Fly.io app (choose unique name)
flyctl apps create tynebase-backend-staging --region lhr

# Set all secrets
flyctl secrets set SUPABASE_URL="https://xxxx.supabase.co" -a tynebase-backend-staging
flyctl secrets set SUPABASE_SECRET_KEY="sb_secret_xxx" -a tynebase-backend-staging
flyctl secrets set SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxx" -a tynebase-backend-staging

# CORS - update with your actual domains
flyctl secrets set ALLOWED_ORIGINS="https://staging.tynebase.com,https://*.staging.tynebase.com,https://*.vercel.app" -a tynebase-backend-staging

# Rate limiting
flyctl secrets set RATE_LIMIT_GLOBAL="100" -a tynebase-backend-staging
flyctl secrets set RATE_LIMIT_WINDOW_GLOBAL="600000" -a tynebase-backend-staging
flyctl secrets set RATE_LIMIT_AI="10" -a tynebase-backend-staging
flyctl secrets set RATE_LIMIT_WINDOW_AI="60000" -a tynebase-backend-staging

# Google Cloud (Vertex AI for Gemini)
# Encode your service account JSON:
# PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
flyctl secrets set GCP_SERVICE_ACCOUNT_JSON="base64_encoded_json" -a tynebase-backend-staging
flyctl secrets set GOOGLE_CLOUD_PROJECT="your-gcp-project" -a tynebase-backend-staging

# Optional: Video processing
flyctl secrets set DELETE_VIDEO_AFTER_PROCESSING="false" -a tynebase-backend-staging
```

### 3.3 Deploy Backend

```bash
# Deploy with config file
flyctl deploy -a tynebase-backend-staging -c fly.toml

# Monitor deployment
flyctl status -a tynebase-backend-staging
flyctl logs -a tynebase-backend-staging

# Verify health endpoint
curl https://tynebase-backend-staging.fly.dev/health
```

**Expected Response**:
```json
{"status":"ok","timestamp":"2026-02-01T..."}
```

### 3.4 Deploy Collaboration Server

```bash
# Create collab app
flyctl apps create tynebase-collab-staging --region lhr

# Set secrets (minimal - only needs Supabase)
flyctl secrets set SUPABASE_URL="https://xxxx.supabase.co" -a tynebase-collab-staging
flyctl secrets set SUPABASE_SECRET_KEY="sb_secret_xxx" -a tynebase-collab-staging

# Deploy
flyctl deploy -a tynebase-collab-staging -c fly.collab.toml

# Verify
flyctl status -a tynebase-collab-staging
```

### 3.5 Verify Backend Services

```bash
# Test API
curl https://tynebase-backend-staging.fly.dev/health

# Test AI endpoint (should return 401 without auth, not 404)
curl -I https://tynebase-backend-staging.fly.dev/api/ai/generate

# Get Fly.io URLs for Vercel env vars
flyctl status -a tynebase-backend-staging --json | findstr hostname
```

---

## Phase 4: Vercel Frontend Deployment

### 4.1 Prepare Environment Variables

Create a file with all Vercel environment variables:

```bash
# staging-env.txt - You'll paste these into Vercel UI
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx

NEXT_PUBLIC_APP_URL=https://staging.tynebase.com
NEXT_PUBLIC_API_URL=https://tynebase-backend-staging.fly.dev
NEXT_PUBLIC_WS_URL=wss://tynebase-collab-staging.fly.dev
NEXT_PUBLIC_BASE_DOMAIN=staging.tynebase.com

NODE_ENV=production
```

### 4.2 Import Project to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import from GitHub (client's repo)
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `tynebase-frontend`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`

### 4.3 Set Environment Variables

In Vercel Project Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Production |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_xxx` | Production |
| `SUPABASE_SECRET_KEY` | `sb_secret_xxx` | Production |
| `NEXT_PUBLIC_APP_URL` | `https://staging.tynebase.com` | Production |
| `NEXT_PUBLIC_API_URL` | `https://tynebase-backend-staging.fly.dev` | Production |
| `NEXT_PUBLIC_WS_URL` | `wss://tynebase-collab-staging.fly.dev` | Production |
| `NEXT_PUBLIC_BASE_DOMAIN` | `staging.tynebase.com` | Production |

**Important**: Click "Save" and redeploy after setting variables.

### 4.4 Deploy

1. Click "Deploy" in Vercel
2. Wait for build to complete (2-5 minutes)
3. Vercel provides temporary URL: `https://tynebase-frontend-xxx.vercel.app`

### 4.5 Verify Frontend

```bash
# Test Vercel deployment
curl https://tynebase-frontend-xxx.vercel.app

# Should return HTML with no errors
```

---

## Phase 5: Domain Routing

### 5.1 Add Domain to Vercel

1. Go to Vercel Project → Settings → Domains
2. Click "Add Domain"
3. Enter: `staging.tynebase.com`
4. Vercel will show DNS records to add

### 5.2 Configure DNS

In your domain registrar/DNS provider:

```dns
; Root domain -> Vercel
A     staging.tynebase.com     76.76.21.21

; Wildcard for multi-tenancy
CNAME *.staging.tynebase.com   cname.vercel-dns.com
```

**Alternative with Cloudflare** (recommended):
1. Add domain to Cloudflare
2. Set records:
   ```dns
   A     staging.tynebase.com     76.76.21.21
   CNAME *.staging.tynebase.com   cname.vercel-dns.com
   ```
3. Enable Cloudflare proxy (orange cloud) for DDoS protection

### 5.3 Verify Domain

```bash
# Check DNS propagation
dig staging.tynebase.com
dig test.staging.tynebase.com

# Both should resolve to Vercel IPs
```

### 5.4 Update Fly.io CORS

After domain is confirmed working, update CORS:

```bash
flyctl secrets set ALLOWED_ORIGINS="https://staging.tynebase.com,https://*.staging.tynebase.com" -a tynebase-backend-staging

# Restart to apply
flyctl deploy -a tynebase-backend-staging -c fly.toml
```

---

## Phase 6: Post-Deployment Verification

### 6.1 Health Checks

```bash
# Test all endpoints
echo "=== Frontend ==="
curl -s https://staging.tynebase.com | head -20

echo "=== Backend Health ==="
curl -s https://tynebase-backend-staging.fly.dev/health

echo "=== Supabase Connection ==="
curl -s https://tynebase-backend-staging.fly.dev/health
```

### 6.2 End-to-End Testing

1. **Visit**: `https://staging.tynebase.com`
2. **Sign Up**: Create test account
3. **Create Tenant**: Should redirect to `tenantname.staging.tynebase.com`
4. **Create Document**: Test editor loads
5. **AI Assistant**: Test generate content
6. **Collaboration**: Open two browsers, edit same document
7. **Export**: Test PDF/DOCX/Markdown export

### 6.3 Dashboard Feature Checklist

- [ ] Authentication (signup/login/logout)
- [ ] Tenant creation with subdomain
- [ ] Document CRUD operations
- [ ] Rich text editor with formatting
- [ ] AI generation (write/continue/enhance)
- [ ] Category management
- [ ] Template selection
- [ ] Document export (PDF, DOCX, Markdown)
- [ ] Real-time collaboration cursors
- [ ] Credit system display
- [ ] User profile/settings

---

## Phase 7: Security Hardening

### 7.1 Enable RLS Policies

In Supabase Dashboard:

1. Go to Database → Tables
2. For each table, enable RLS if not already:
   - `tenants` - Users can only see their tenant
   - `documents` - Users can only see their tenant's documents
   - `users` - Users can only see their own profile

### 7.2 Storage Policies

1. Go to Storage → Policies
2. Ensure buckets are private except logos/avatars
3. Add policies restricting access by tenant

### 7.3 Rate Limiting Verification

```bash
# Test rate limiting (should block after 10 requests)
for i in {1..15}; do
  curl -I https://tynebase-backend-staging.fly.dev/api/ai/generate
done
```

### 7.4 CORS Check

```bash
# Verify CORS headers
curl -I -H "Origin: https://evil.com" https://tynebase-backend-staging.fly.dev/health
# Should NOT have Access-Control-Allow-Origin for evil.com

curl -I -H "Origin: https://staging.tynebase.com" https://tynebase-backend-staging.fly.dev/health
# SHOULD have Access-Control-Allow-Origin for staging.tynebase.com
```

---

## Troubleshooting

### Issue: Backend connection errors in frontend

**Symptoms**: Frontend shows "API connection failed"

**Fix**:
```bash
# 1. Check CORS origins
flyctl secrets list -a tynebase-backend-staging

# 2. Update with correct domain
flyctl secrets set ALLOWED_ORIGINS="https://staging.tynebase.com" -a tynebase-backend-staging
flyctl deploy -a tynebase-backend-staging -c fly.toml
```

### Issue: Supabase auth not working

**Symptoms**: Can't sign up/login

**Fix**:
1. Check Supabase Auth → URL Configuration
2. Verify redirect URLs include your domain
3. Check `NEXT_PUBLIC_SUPABASE_URL` in Vercel matches Supabase project

### Issue: WebSocket collaboration not working

**Symptoms**: No real-time cursors, "Connection failed"

**Fix**:
```bash
# Check collab server status
flyctl status -a tynebase-collab-staging
flyctl logs -a tynebase-collab-staging

# Verify WS_URL in Vercel env vars
# Should be: wss://tynebase-collab-staging.fly.dev (not http)
```

### Issue: AI generation fails

**Symptoms**: AI endpoints return 500

**Fix**:
```bash
# Check backend logs
flyctl logs -a tynebase-backend-staging

# Common issues:
# - GCP_SERVICE_ACCOUNT_JSON not set
# - Invalid base64 encoding of service account
# - Vertex AI API not enabled in GCP
```

### Issue: Database migration errors

**Symptoms**: Missing tables, 500 errors on data fetch

**Fix**:
```bash
# Check migration status
supabase migration list

# Re-push if needed
supabase db push

# Or reset (WARNING: deletes data)
supabase db reset --linked
```

---

## Rollback Plan

If deployment fails:

### 1. Frontend Rollback
- In Vercel: Go to Deployments → Find previous working deployment → "Promote to Production"

### 2. Backend Rollback
```bash
# View previous releases
flyctl releases list -a tynebase-backend-staging

# Rollback to specific version
flyctl deploy -a tynebase-backend-staging --image tynebase-backend-staging:previous-tag
```

### 3. Database Rollback
```bash
# Restore from Supabase backup
# Go to Supabase Dashboard → Database → Backups → Restore
```

---

## Summary

After completing this guide, you will have:

- Frontend deployed on Vercel with custom domain
- Backend API on Fly.io with auto-scaling
- Collaboration server on Fly.io for real-time editing
- Supabase database with all migrations applied
- Wildcard SSL for multi-tenancy
- All Milestone 2 features live

**Estimated Time**: 2-3 hours  
**Estimated Cost**:
- Vercel Pro: $20/month
- Fly.io: $10-15/month (2 apps)
- Supabase: $25/month (or free tier)
- Domain: $10-15/year

**Next Steps After Deployment**:
1. Create initial admin tenant
2. Test all features with real data
3. Set up monitoring (optional: Axiom, Sentry)
4. Schedule security audit
5. Plan Milestone 3 (community features)

---

## Quick Reference Commands

```bash
# Fly.io
flyctl status -a tynebase-backend-staging
flyctl logs -a tynebase-backend-staging -f
flyctl secrets list -a tynebase-backend-staging
flyctl deploy -a tynebase-backend-staging -c fly.toml

# Supabase
supabase db push
supabase migration list
supabase link --project-ref xxx

# Vercel
vercel --prod
vercel env ls

# Testing
curl https://tynebase-backend-staging.fly.dev/health
curl https://staging.tynebase.com
```

**Support Links**:
- Fly.io Docs: https://fly.io/docs
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Existing Guides: `/docs/DEPLOYMENT_GUIDE.md`, `/docs/PRODUCTION_DEPLOYMENT.md`
