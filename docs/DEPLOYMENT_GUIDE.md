# TyneBase Deployment Guide - Fly.io

**Complete guide for deploying TyneBase backend services to Fly.io**

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Initial Setup](#initial-setup)
5. [Backend API Deployment](#backend-api-deployment)
6. [Collaboration Server Deployment](#collaboration-server-deployment)
7. [Environment Variables & Secrets](#environment-variables--secrets)
8. [Database Setup](#database-setup)
9. [Monitoring & Logs](#monitoring--logs)
10. [Scaling & Performance](#scaling--performance)
11. [Secret Rotation](#secret-rotation)
12. [Troubleshooting](#troubleshooting)
13. [Production Checklist](#production-checklist)

---

## Overview

TyneBase consists of two main backend services deployed on Fly.io:

- **Backend API** (`tynebase-backend`): Main Fastify server with RAG capabilities
- **Collaboration Server** (`tynebase-collab`): Hocuspocus WebSocket server for real-time collaboration

Both services are containerized using Docker and deployed to Fly.io's global edge network.

---

## Prerequisites

Before deploying, ensure you have:

- ✅ [Fly.io account](https://fly.io/app/sign-up) (free tier available)
- ✅ [Flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- ✅ [Supabase project](https://supabase.com) with migrations applied
- ✅ [Google Cloud project](https://console.cloud.google.com) with Vertex AI enabled
- ✅ Git repository with TyneBase code
- ✅ Node.js 18+ installed locally (for testing)

### Install Flyctl

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Verify installation:**
```bash
flyctl version
```

### Authenticate with Fly.io

```bash
flyctl auth login
```

This will open a browser window for authentication.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Fly.io Edge                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │  tynebase-backend    │      │  tynebase-collab     │    │
│  │  (API Server)        │      │  (WebSocket Server)  │    │
│  │  Port: 8080          │      │  Port: 8081          │    │
│  │  Processes:          │      │  Process:            │    │
│  │  - api (Fastify)     │      │  - Hocuspocus        │    │
│  │  - worker (optional) │      │                      │    │
│  └──────────┬───────────┘      └──────────┬───────────┘    │
│             │                              │                 │
└─────────────┼──────────────────────────────┼─────────────────┘
              │                              │
              └──────────────┬───────────────┘
                             │
                    ┌────────▼────────┐
                    │   Supabase      │
                    │   PostgreSQL    │
                    │   + pgvector    │
                    └─────────────────┘
```

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/tynebase.git
cd tynebase
```

### 2. Verify Dockerfiles

Ensure these files exist:
- `backend/Dockerfile` - Backend API container
- `Dockerfile.collab` - Collaboration server container

### 3. Verify Fly.io Configuration

Ensure these files exist:
- `fly.toml` - Backend API configuration
- `fly.collab.toml` - Collaboration server configuration

---

## Backend API Deployment

### Step 1: Create Fly.io App

```bash
# Navigate to backend directory
cd backend

# Create app (choose a unique name)
flyctl apps create tynebase-backend

# Or use the existing app name from fly.toml
flyctl apps create tynebase-backend --region lhr
```

**Available regions:**
- `lhr` - London, UK
- `iad` - Ashburn, VA (US East)
- `sjc` - San Jose, CA (US West)
- `fra` - Frankfurt, Germany
- `syd` - Sydney, Australia

### Step 2: Set Secrets

Set all required environment variables as secrets:

```bash
# Supabase Configuration
flyctl secrets set SUPABASE_URL="https://your-project.supabase.co" -a tynebase-backend

# NEW Supabase API Keys (preferred)
flyctl secrets set SUPABASE_SECRET_KEY="sb_secret_..." -a tynebase-backend
flyctl secrets set SUPABASE_PUBLISHABLE_KEY="sb_publishable_..." -a tynebase-backend

# OLD Supabase Keys (deprecated, only if new keys not available)
# flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..." -a tynebase-backend
# flyctl secrets set SUPABASE_ANON_KEY="eyJhbGci..." -a tynebase-backend

# CORS Configuration
flyctl secrets set ALLOWED_ORIGINS="https://your-frontend.vercel.app,https://your-domain.com" -a tynebase-backend

# Rate Limiting
flyctl secrets set RATE_LIMIT_GLOBAL="100" -a tynebase-backend
flyctl secrets set RATE_LIMIT_WINDOW_GLOBAL="600000" -a tynebase-backend
flyctl secrets set RATE_LIMIT_AI="10" -a tynebase-backend
flyctl secrets set RATE_LIMIT_WINDOW_AI="60000" -a tynebase-backend

# Google Cloud Vertex AI (for Gemini models)
flyctl secrets set GCP_SERVICE_ACCOUNT_JSON="base64_encoded_json_here" -a tynebase-backend
flyctl secrets set GOOGLE_CLOUD_PROJECT="your-gcp-project-id" -a tynebase-backend

# Optional: Axiom Logging
flyctl secrets set AXIOM_DATASET="tynebase-logs" -a tynebase-backend
flyctl secrets set AXIOM_TOKEN="your-axiom-token" -a tynebase-backend

# Optional: Video Processing
flyctl secrets set DELETE_VIDEO_AFTER_PROCESSING="false" -a tynebase-backend
```

**View current secrets:**
```bash
flyctl secrets list -a tynebase-backend
```

### Step 3: Deploy Backend API

```bash
# From backend directory
flyctl deploy -a tynebase-backend

# Or from project root
flyctl deploy -a tynebase-backend -c fly.toml
```

**Monitor deployment:**
```bash
flyctl status -a tynebase-backend
flyctl logs -a tynebase-backend
```

### Step 4: Verify Deployment

```bash
# Check app status
flyctl status -a tynebase-backend

# Test health endpoint
curl https://tynebase-backend.fly.dev/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-26T00:00:00.000Z"}
```

---

## Collaboration Server Deployment

### Step 1: Create Fly.io App

```bash
# From project root
flyctl apps create tynebase-collab --region lhr
```

### Step 2: Set Secrets

```bash
# Supabase Configuration
flyctl secrets set SUPABASE_URL="https://your-project.supabase.co" -a tynebase-collab

# NEW Supabase API Key (preferred)
flyctl secrets set SUPABASE_SECRET_KEY="sb_secret_..." -a tynebase-collab

# OLD Supabase Key (deprecated, only if new key not available)
# flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..." -a tynebase-collab
```

### Step 3: Deploy Collaboration Server

```bash
# From project root
flyctl deploy -a tynebase-collab -c fly.collab.toml
```

**Monitor deployment:**
```bash
flyctl status -a tynebase-collab
flyctl logs -a tynebase-collab
```

### Step 4: Verify WebSocket Connection

```bash
# Check app status
flyctl status -a tynebase-collab

# Test WebSocket endpoint (requires WebSocket client)
# wscat -c wss://tynebase-collab.fly.dev
```

---

## Environment Variables & Secrets

### Required Secrets - Backend API

| Secret | Description | Example | Required |
|--------|-------------|---------|----------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` | ✅ |
| `SUPABASE_SECRET_KEY` | New Supabase secret key | `sb_secret_...` | ✅ (preferred) |
| `SUPABASE_PUBLISHABLE_KEY` | New Supabase publishable key | `sb_publishable_...` | ✅ (preferred) |
| `SUPABASE_SERVICE_ROLE_KEY` | Old service role key | `eyJhbGci...` | ⚠️ (deprecated) |
| `SUPABASE_ANON_KEY` | Old anon key | `eyJhbGci...` | ⚠️ (deprecated) |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://app.com` | ✅ |
| `RATE_LIMIT_GLOBAL` | Global rate limit | `100` | ✅ |
| `RATE_LIMIT_WINDOW_GLOBAL` | Global window (ms) | `600000` | ✅ |
| `RATE_LIMIT_AI` | AI endpoint rate limit | `10` | ✅ |
| `RATE_LIMIT_WINDOW_AI` | AI window (ms) | `60000` | ✅ |
| `GCP_SERVICE_ACCOUNT_JSON` | Base64 GCP credentials | `base64_string` | ✅ |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | `my-project-123` | ✅ |

### Optional Secrets - Backend API

| Secret | Description | Default |
|--------|-------------|---------|
| `AXIOM_DATASET` | Axiom logging dataset | - |
| `AXIOM_TOKEN` | Axiom API token | - |
| `DELETE_VIDEO_AFTER_PROCESSING` | Delete videos after transcription | `false` |

### Required Secrets - Collaboration Server

| Secret | Description | Example | Required |
|--------|-------------|---------|----------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` | ✅ |
| `SUPABASE_SECRET_KEY` | New Supabase secret key | `sb_secret_...` | ✅ (preferred) |
| `SUPABASE_SERVICE_ROLE_KEY` | Old service role key | `eyJhbGci...` | ⚠️ (deprecated) |

### Environment Variables (Non-Secret)

These are set in `fly.toml` and `fly.collab.toml`:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `8080` / `8081` | Server port |
| `LOG_LEVEL` | `info` | Logging level |

---

## Database Setup

### 1. Run Supabase Migrations

Ensure all migrations are applied to your Supabase database:

```bash
# Link to your Supabase project
npx supabase link --project-ref your-project-ref

# Push migrations to remote database
npx supabase db push

# Verify migrations
npx supabase migration list
```

### 2. Verify Database Schema

Check that these components exist:

**Tables:**
- `tenants`, `users`, `documents`, `categories`
- `document_versions`, `document_embeddings`
- `templates`, `discussions`, `discussion_replies`
- `notifications`, `audit_logs`
- `ai_generation_jobs`, `content_audit_reports`
- `user_consents`, `credit_pools`, `query_usage`

**Extensions:**
- `pgvector` - Vector similarity search
- `uuid-ossp` - UUID generation

**Storage Buckets:**
- `avatars`, `documents`, `logos`, `videos`

### 3. Test Database Connection

```bash
# From backend directory
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);
supabase.from('tenants').select('count').then(console.log);
"
```

---

## Monitoring & Logs

### View Real-time Logs

```bash
# Backend API logs
flyctl logs -a tynebase-backend

# Collaboration server logs
flyctl logs -a tynebase-collab

# Follow logs in real-time
flyctl logs -a tynebase-backend -f
```

### Application Metrics

```bash
# View app metrics
flyctl metrics -a tynebase-backend

# View VM status
flyctl status -a tynebase-backend
```

### Health Checks

Both services have health check endpoints:

**Backend API:**
```bash
curl https://tynebase-backend.fly.dev/health
```

**Collaboration Server:**
- TCP check on port 8081 (configured in `fly.collab.toml`)

### Axiom Logging (Optional)

For advanced logging and analytics:

1. Create account at [axiom.co](https://axiom.co)
2. Create dataset: `tynebase-logs`
3. Generate API token
4. Set secrets:
   ```bash
   flyctl secrets set AXIOM_DATASET="tynebase-logs" -a tynebase-backend
   flyctl secrets set AXIOM_TOKEN="your-token" -a tynebase-backend
   ```

---

## Scaling & Performance

### Auto-scaling Configuration

Both services are configured for auto-scaling in their respective `fly.toml` files:

```toml
[scaling]
  min_machines = 1
  max_machines = 3
```

### Manual Scaling

```bash
# Scale to specific number of instances
flyctl scale count 2 -a tynebase-backend

# Scale VM resources
flyctl scale vm shared-cpu-1x --memory 1024 -a tynebase-backend
```

### VM Resources

**Current configuration:**
- CPU: 1 shared vCPU
- Memory: 512 MB
- Disk: Ephemeral (container-based)

**Upgrade options:**
```bash
# Upgrade to 1GB RAM
flyctl scale vm shared-cpu-1x --memory 1024 -a tynebase-backend

# Upgrade to dedicated CPU
flyctl scale vm dedicated-cpu-1x --memory 2048 -a tynebase-backend
```

### Concurrency Limits

**Backend API:**
- Soft limit: 200 connections
- Hard limit: 250 connections

**Collaboration Server:**
- Soft limit: 400 connections
- Hard limit: 500 connections

Adjust in `fly.toml` / `fly.collab.toml`:
```toml
[services.concurrency]
  type = "connections"
  hard_limit = 500
  soft_limit = 400
```

---

## Secret Rotation

### Why Rotate Secrets?

- Security best practice (rotate every 90 days)
- Compliance requirements
- Suspected compromise
- Team member departure

### Rotation Process

#### 1. Supabase API Keys

**Using NEW API Keys (Recommended):**

```bash
# Step 1: Generate new keys in Supabase Dashboard
# Go to: Project Settings → API Keys → "Create new API Keys"

# Step 2: Set new keys in Fly.io (zero downtime)
flyctl secrets set SUPABASE_SECRET_KEY="sb_secret_NEW_KEY" -a tynebase-backend
flyctl secrets set SUPABASE_PUBLISHABLE_KEY="sb_publishable_NEW_KEY" -a tynebase-backend

# Step 3: Deploy will automatically restart with new keys
# (Fly.io restarts app when secrets change)

# Step 4: Verify new keys are working
flyctl logs -a tynebase-backend

# Step 5: Deactivate old keys in Supabase Dashboard
# Wait 24-48 hours, then deactivate old keys

# Step 6: Delete old keys after 7 days
```

**Using OLD JWT Keys (Deprecated):**

⚠️ **Warning:** Rotating old JWT-based keys requires downtime. Migrate to new API keys first.

```bash
# Step 1: Generate new service role key in Supabase
# Go to: Project Settings → API → "Reset service_role key"

# Step 2: Update secret
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="eyJhbGci_NEW_KEY" -a tynebase-backend

# Step 3: App will restart automatically
```

#### 2. Google Cloud Service Account

```bash
# Step 1: Create new service account in GCP Console
# Go to: IAM & Admin → Service Accounts → Create Service Account

# Step 2: Grant Vertex AI User role

# Step 3: Create and download JSON key

# Step 4: Base64 encode the key
# Linux/Mac:
cat service-account.json | base64 -w 0

# Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))

# Step 5: Update secret
flyctl secrets set GCP_SERVICE_ACCOUNT_JSON="NEW_BASE64_STRING" -a tynebase-backend

# Step 6: Verify deployment
flyctl logs -a tynebase-backend

# Step 7: Delete old service account key in GCP Console
```

#### 3. Axiom Token

```bash
# Step 1: Generate new token in Axiom Dashboard
# Go to: Settings → API Tokens → Create Token

# Step 2: Update secret
flyctl secrets set AXIOM_TOKEN="NEW_TOKEN" -a tynebase-backend

# Step 3: Revoke old token in Axiom Dashboard
```

### Rotation Checklist

- [ ] Generate new credentials in source system
- [ ] Update Fly.io secrets
- [ ] Verify app restarts successfully
- [ ] Monitor logs for authentication errors
- [ ] Test critical endpoints
- [ ] Wait 24-48 hours for traffic to stabilize
- [ ] Deactivate old credentials
- [ ] Document rotation in change log
- [ ] Schedule next rotation (90 days)

---

## Troubleshooting

### Deployment Failures

**Problem:** `flyctl deploy` fails with build errors

**Solutions:**
```bash
# 1. Check Dockerfile syntax
docker build -f backend/Dockerfile -t test-build backend/

# 2. Verify all dependencies in package.json
cd backend && npm install

# 3. Check TypeScript compilation
npm run build

# 4. Review build logs
flyctl logs -a tynebase-backend

# 5. Try deploying with verbose logging
flyctl deploy -a tynebase-backend --verbose
```

### Application Crashes

**Problem:** App crashes immediately after deployment

**Solutions:**
```bash
# 1. Check logs for errors
flyctl logs -a tynebase-backend

# 2. Verify all required secrets are set
flyctl secrets list -a tynebase-backend

# 3. Test environment variable validation
# Look for "Missing or invalid environment variables" errors

# 4. SSH into VM to debug
flyctl ssh console -a tynebase-backend

# 5. Check health endpoint
curl https://tynebase-backend.fly.dev/health
```

### Database Connection Errors

**Problem:** "Failed to connect to Supabase" errors

**Solutions:**
```bash
# 1. Verify SUPABASE_URL is correct
flyctl secrets list -a tynebase-backend

# 2. Check Supabase project is not paused
# Go to Supabase Dashboard → Project Settings

# 3. Verify API keys are valid
# Test keys using Supabase REST API

# 4. Check network connectivity
flyctl ssh console -a tynebase-backend
curl https://your-project.supabase.co/rest/v1/

# 5. Review RLS policies
# Ensure service role key bypasses RLS
```

### High Memory Usage

**Problem:** App crashes with OOM (Out of Memory) errors

**Solutions:**
```bash
# 1. Check current memory usage
flyctl metrics -a tynebase-backend

# 2. Upgrade VM memory
flyctl scale vm shared-cpu-1x --memory 1024 -a tynebase-backend

# 3. Review application logs for memory leaks
flyctl logs -a tynebase-backend | grep -i "memory"

# 4. Optimize large file processing
# Implement streaming for document uploads

# 5. Add memory limits to Docker
# Update Dockerfile with NODE_OPTIONS
ENV NODE_OPTIONS="--max-old-space-size=512"
```

### Slow Response Times

**Problem:** API endpoints respond slowly

**Solutions:**
```bash
# 1. Check VM location vs. database location
# Ensure both are in same region (lhr)

# 2. Enable connection pooling
# Already enabled in supabase.ts

# 3. Review database query performance
# Use Supabase Dashboard → Logs → Performance

# 4. Scale horizontally
flyctl scale count 2 -a tynebase-backend

# 5. Upgrade VM resources
flyctl scale vm dedicated-cpu-1x --memory 2048 -a tynebase-backend
```

### WebSocket Connection Issues

**Problem:** Collaboration server WebSocket connections fail

**Solutions:**
```bash
# 1. Check collaboration server status
flyctl status -a tynebase-collab

# 2. Verify WebSocket upgrade headers
# Check nginx/proxy configuration

# 3. Test WebSocket connection
wscat -c wss://tynebase-collab.fly.dev

# 4. Review collaboration server logs
flyctl logs -a tynebase-collab

# 5. Check concurrency limits
# Increase in fly.collab.toml if needed
```

### SSL/TLS Certificate Errors

**Problem:** HTTPS certificate errors

**Solutions:**
```bash
# 1. Fly.io automatically provisions certificates
# Wait 5-10 minutes after deployment

# 2. Check certificate status
flyctl certs show -a tynebase-backend

# 3. Force certificate renewal
flyctl certs create tynebase-backend.fly.dev -a tynebase-backend

# 4. Verify DNS configuration
dig tynebase-backend.fly.dev
```

---

## Production Checklist

Before going live, ensure:

### Infrastructure
- [ ] Fly.io apps created: `tynebase-backend` and `tynebase-collab`
- [ ] Apps deployed to appropriate region (close to users)
- [ ] SSL certificates provisioned and valid
- [ ] Health checks passing for both services
- [ ] Auto-scaling configured (min: 1, max: 3)

### Secrets & Configuration
- [ ] All required secrets set in Fly.io
- [ ] **NEW** Supabase API keys configured (preferred)
- [ ] Google Cloud service account configured
- [ ] CORS origins include production domains
- [ ] Rate limits configured appropriately
- [ ] Environment variables validated

### Database
- [ ] All Supabase migrations applied
- [ ] pgvector extension enabled
- [ ] RLS policies enabled on all tables
- [ ] Storage buckets created and configured
- [ ] Database backups enabled in Supabase

### Security
- [ ] Secrets rotated (if using existing keys)
- [ ] Service account has minimum required permissions
- [ ] CORS restricted to production domains only
- [ ] Rate limiting enabled
- [ ] Helmet security headers enabled
- [ ] No secrets in source code or logs

### Monitoring
- [ ] Fly.io metrics dashboard reviewed
- [ ] Log aggregation configured (Axiom optional)
- [ ] Health check endpoints tested
- [ ] Error tracking configured
- [ ] Alerting configured for critical errors

### Testing
- [ ] Health endpoints return 200 OK
- [ ] Authentication flows tested
- [ ] Document upload/download tested
- [ ] AI generation endpoints tested
- [ ] RAG query endpoints tested
- [ ] Collaboration WebSocket tested
- [ ] Rate limiting tested
- [ ] Error handling tested

### Documentation
- [ ] Deployment runbook created
- [ ] Secret rotation schedule documented
- [ ] Incident response procedures documented
- [ ] API documentation published
- [ ] Team trained on deployment process

### Performance
- [ ] Load testing completed
- [ ] Database query performance optimized
- [ ] Response times under 200ms (p95)
- [ ] WebSocket latency acceptable
- [ ] Memory usage stable under load

---

## Useful Commands

### Deployment
```bash
# Deploy backend API
flyctl deploy -a tynebase-backend

# Deploy collaboration server
flyctl deploy -a tynebase-collab

# Deploy with specific Dockerfile
flyctl deploy -a tynebase-backend --dockerfile backend/Dockerfile

# Deploy without cache
flyctl deploy -a tynebase-backend --no-cache
```

### Secrets Management
```bash
# List all secrets
flyctl secrets list -a tynebase-backend

# Set a secret
flyctl secrets set KEY="value" -a tynebase-backend

# Set multiple secrets
flyctl secrets set KEY1="value1" KEY2="value2" -a tynebase-backend

# Unset a secret
flyctl secrets unset KEY -a tynebase-backend

# Import secrets from file
flyctl secrets import -a tynebase-backend < secrets.txt
```

### Monitoring
```bash
# View logs
flyctl logs -a tynebase-backend

# Follow logs in real-time
flyctl logs -a tynebase-backend -f

# View metrics
flyctl metrics -a tynebase-backend

# Check app status
flyctl status -a tynebase-backend

# List all apps
flyctl apps list
```

### Scaling
```bash
# Scale instances
flyctl scale count 2 -a tynebase-backend

# Scale VM size
flyctl scale vm shared-cpu-1x --memory 1024 -a tynebase-backend

# View current scale
flyctl scale show -a tynebase-backend
```

### Debugging
```bash
# SSH into VM
flyctl ssh console -a tynebase-backend

# Run command in VM
flyctl ssh console -a tynebase-backend -C "node --version"

# Proxy to local port
flyctl proxy 8080:8080 -a tynebase-backend

# View VM list
flyctl vms list -a tynebase-backend
```

### Certificates
```bash
# List certificates
flyctl certs list -a tynebase-backend

# Show certificate details
flyctl certs show tynebase-backend.fly.dev -a tynebase-backend

# Add custom domain
flyctl certs create custom-domain.com -a tynebase-backend
```

---

## Support Resources

- **Fly.io Documentation**: [https://fly.io/docs](https://fly.io/docs)
- **Fly.io Community**: [https://community.fly.io](https://community.fly.io)
- **Supabase Documentation**: [https://supabase.com/docs](https://supabase.com/docs)
- **Google Cloud Vertex AI**: [https://cloud.google.com/vertex-ai/docs](https://cloud.google.com/vertex-ai/docs)
- **Fastify Documentation**: [https://www.fastify.io/docs](https://www.fastify.io/docs)
- **Hocuspocus Documentation**: [https://tiptap.dev/hocuspocus](https://tiptap.dev/hocuspocus)

---

## Next Steps

After successful deployment:

1. **Configure Custom Domain** (optional)
   - Add custom domain in Fly.io dashboard
   - Update DNS records
   - Update CORS origins

2. **Set Up Monitoring**
   - Configure Axiom for log aggregation
   - Set up error tracking (Sentry, etc.)
   - Configure uptime monitoring

3. **Performance Optimization**
   - Review response times
   - Optimize database queries
   - Configure CDN for static assets

4. **Security Hardening**
   - Review RLS policies
   - Audit API endpoints
   - Implement rate limiting per user
   - Schedule regular security audits

5. **Backup Strategy**
   - Configure Supabase automated backups
   - Document recovery procedures
   - Test backup restoration

---

**Congratulations! Your TyneBase backend is now deployed on Fly.io! 🚀**
