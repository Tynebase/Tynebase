# TyneBase Operational Runbook

**Complete guide for operating, troubleshooting, and maintaining TyneBase in production**

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Health Checks & Monitoring](#health-checks--monitoring)
4. [Common Issues & Solutions](#common-issues--solutions)
5. [Debugging Procedures](#debugging-procedures)
6. [Rollback Procedures](#rollback-procedures)
7. [Incident Response](#incident-response)
8. [Database Operations](#database-operations)
9. [Performance Troubleshooting](#performance-troubleshooting)
10. [Security Incidents](#security-incidents)
11. [Maintenance Windows](#maintenance-windows)
12. [Escalation Procedures](#escalation-procedures)

---

## Overview

### Purpose

This runbook provides operational procedures for TyneBase production systems, including:
- Common issue diagnosis and resolution
- Debugging workflows
- Rollback procedures for failed deployments
- Incident response protocols
- Emergency contacts and escalation paths

### System Components

- **Backend API** (Fly.io: `tynebase-backend`)
- **Collaboration Server** (Fly.io: `tynebase-collab`)
- **Frontend** (Vercel: `tynebase-frontend`)
- **Database** (Supabase PostgreSQL + pgvector)
- **Storage** (Supabase Storage)
- **AI Services** (Google Cloud Vertex AI)

### On-Call Responsibilities

- Monitor system health and alerts
- Respond to incidents within SLA (15 minutes)
- Execute runbook procedures
- Escalate when necessary
- Document all incidents

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Internet Traffic                      │
└────────────┬────────────────────────────┬────────────────┘
             │                            │
    ┌────────▼────────┐          ┌───────▼────────┐
    │  Vercel CDN     │          │  Fly.io Edge   │
    │  (Frontend)     │          │  (Backend)     │
    └────────┬────────┘          └───────┬────────┘
             │                            │
             │                   ┌────────▼────────┐
             │                   │  tynebase-      │
             │                   │  backend        │
             │                   │  (API)          │
             │                   └────────┬────────┘
             │                            │
             │                   ┌────────▼────────┐
             │                   │  tynebase-      │
             │                   │  collab         │
             │                   │  (WebSocket)    │
             │                   └────────┬────────┘
             │                            │
             └────────────┬───────────────┘
                          │
                 ┌────────▼────────┐
                 │   Supabase      │
                 │   PostgreSQL    │
                 │   + Storage     │
                 └─────────────────┘
                          │
                 ┌────────▼────────┐
                 │  Google Cloud   │
                 │  Vertex AI      │
                 └─────────────────┘
```

---

## Health Checks & Monitoring

### Health Endpoints

**Backend API:**
```bash
curl https://tynebase-backend.fly.dev/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T00:00:00.000Z",
  "uptime": 12345,
  "environment": "production"
}
```

**Collaboration Server:**
- TCP health check on port 8081 (automated by Fly.io)
- WebSocket connection test:
  ```bash
  wscat -c wss://tynebase-collab.fly.dev
  ```

**Frontend:**
```bash
curl https://tynebase.vercel.app
```

### Monitoring Dashboards

**Fly.io Metrics:**
```bash
flyctl metrics -a tynebase-backend
flyctl metrics -a tynebase-collab
```

**Supabase Dashboard:**
- Navigate to: https://app.supabase.com/project/YOUR_PROJECT_ID
- Check: Database → Logs → API Logs
- Check: Database → Logs → Auth Logs
- Check: Database → Performance

**Vercel Analytics:**
- Navigate to: https://vercel.com/dashboard/analytics
- Monitor: Response times, error rates, traffic patterns

### Key Metrics to Monitor

| Metric | Normal Range | Warning Threshold | Critical Threshold |
|--------|--------------|-------------------|-------------------|
| API Response Time (p95) | < 200ms | > 500ms | > 1000ms |
| Error Rate | < 0.1% | > 1% | > 5% |
| CPU Usage | < 50% | > 70% | > 90% |
| Memory Usage | < 70% | > 80% | > 95% |
| Database Connections | < 50 | > 80 | > 95 |
| Disk Usage | < 70% | > 80% | > 90% |

### Alert Configuration

**Critical Alerts (Page immediately):**
- Service down (health check fails)
- Error rate > 5%
- Database connection pool exhausted
- Security incident detected

**Warning Alerts (Notify during business hours):**
- Response time > 500ms
- Error rate > 1%
- CPU/Memory > 70%
- Disk usage > 80%

---

## Common Issues & Solutions

### Issue 1: Backend API Not Responding

**Symptoms:**
- Health check returns 503 or times out
- Users cannot access the application
- Fly.io dashboard shows app as "unhealthy"

**Diagnosis:**
```bash
# Check app status
flyctl status -a tynebase-backend

# Check recent logs
flyctl logs -a tynebase-backend --limit 100

# Check VM list
flyctl vms list -a tynebase-backend
```

**Common Causes:**
1. **Out of Memory (OOM)** - App crashed due to memory limit
2. **Startup failure** - Missing environment variables or invalid configuration
3. **Database connection failure** - Cannot connect to Supabase
4. **Deployment issue** - Recent deployment introduced bugs

**Solutions:**

**If OOM:**
```bash
# Scale up memory
flyctl scale vm shared-cpu-1x --memory 1024 -a tynebase-backend

# Restart app
flyctl apps restart tynebase-backend
```

**If startup failure:**
```bash
# Check environment variables
flyctl secrets list -a tynebase-backend

# SSH into VM to debug
flyctl ssh console -a tynebase-backend

# Check logs for specific error
flyctl logs -a tynebase-backend | grep -i "error"
```

**If database connection failure:**
```bash
# Verify Supabase is accessible
curl https://YOUR_PROJECT.supabase.co/rest/v1/

# Check SUPABASE_URL and keys are correct
flyctl secrets list -a tynebase-backend

# Test from VM
flyctl ssh console -a tynebase-backend
curl $SUPABASE_URL/rest/v1/
```

**If recent deployment broke it:**
- See [Rollback Procedures](#rollback-procedures)

---

### Issue 2: Collaboration Server WebSocket Failures

**Symptoms:**
- Real-time collaboration not working
- Users see "Connection lost" messages
- WebSocket connections timing out

**Diagnosis:**
```bash
# Check collab server status
flyctl status -a tynebase-collab

# Check logs
flyctl logs -a tynebase-collab

# Test WebSocket connection
wscat -c wss://tynebase-collab.fly.dev
```

**Common Causes:**
1. **Server crashed** - Memory or CPU exhaustion
2. **Too many connections** - Exceeded concurrency limits
3. **Network issues** - Fly.io edge network problems
4. **Authentication failures** - Invalid Supabase credentials

**Solutions:**

**If server crashed:**
```bash
# Restart server
flyctl apps restart tynebase-collab

# Check resource usage
flyctl metrics -a tynebase-collab

# Scale if needed
flyctl scale count 2 -a tynebase-collab
```

**If too many connections:**
```bash
# Increase concurrency limits in fly.collab.toml
# Edit [services.concurrency] section
# hard_limit = 1000  # Increase from 500
# soft_limit = 800   # Increase from 400

# Redeploy
flyctl deploy -a tynebase-collab
```

**If authentication failures:**
```bash
# Verify Supabase credentials
flyctl secrets list -a tynebase-collab

# Update if needed
flyctl secrets set SUPABASE_SECRET_KEY="sb_secret_..." -a tynebase-collab
```

---

### Issue 3: Database Performance Degradation

**Symptoms:**
- Slow API responses (> 1s)
- Timeout errors
- High database CPU usage in Supabase dashboard

**Diagnosis:**
```bash
# Check slow queries in Supabase Dashboard
# Navigate to: Database → Performance → Slow Queries

# Check connection pool
# Navigate to: Database → Logs → Postgres Logs

# Check index usage
# Run in SQL Editor:
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;
```

**Common Causes:**
1. **Missing indexes** - Queries doing full table scans
2. **Connection pool exhaustion** - Too many open connections
3. **Long-running queries** - Blocking other operations
4. **Table bloat** - Tables need vacuuming

**Solutions:**

**If missing indexes:**
```sql
-- Add indexes for slow queries
-- Example: Index on document embeddings
CREATE INDEX CONCURRENTLY idx_document_embeddings_document_id 
ON document_embeddings(document_id);

-- Index on tenant queries
CREATE INDEX CONCURRENTLY idx_documents_tenant_id 
ON documents(tenant_id);
```

**If connection pool exhausted:**
```bash
# Check current connections
SELECT count(*) FROM pg_stat_activity;

# Kill idle connections (in Supabase SQL Editor)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < now() - interval '10 minutes';

# Restart backend to reset connections
flyctl apps restart tynebase-backend
```

**If long-running queries:**
```sql
-- Find long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
AND now() - pg_stat_activity.query_start > interval '5 minutes';

-- Kill specific query
SELECT pg_terminate_backend(PID_HERE);
```

**If table bloat:**
```sql
-- Vacuum tables (run during maintenance window)
VACUUM ANALYZE documents;
VACUUM ANALYZE document_embeddings;
VACUUM ANALYZE audit_logs;
```

---

### Issue 4: AI Generation Failures

**Symptoms:**
- AI generation requests return 500 errors
- "Failed to generate content" errors
- Timeout errors on AI endpoints

**Diagnosis:**
```bash
# Check backend logs for AI errors
flyctl logs -a tynebase-backend | grep -i "vertex\|gemini\|ai"

# Test Vertex AI directly
# SSH into backend
flyctl ssh console -a tynebase-backend

# Check GCP credentials
echo $GCP_SERVICE_ACCOUNT_JSON | base64 -d | jq .
```

**Common Causes:**
1. **Invalid GCP credentials** - Service account key expired or invalid
2. **Quota exceeded** - Hit Vertex AI rate limits
3. **Model unavailable** - Vertex AI service outage
4. **Network timeout** - Slow connection to GCP

**Solutions:**

**If invalid credentials:**
```bash
# Rotate GCP service account key
# 1. Create new key in GCP Console
# 2. Base64 encode it
cat new-service-account.json | base64 -w 0

# 3. Update secret
flyctl secrets set GCP_SERVICE_ACCOUNT_JSON="NEW_BASE64_STRING" -a tynebase-backend
```

**If quota exceeded:**
- Check GCP Console → Vertex AI → Quotas
- Request quota increase if needed
- Implement request queuing/throttling
- Use exponential backoff for retries

**If model unavailable:**
- Check GCP Status: https://status.cloud.google.com/
- Switch to fallback model if configured
- Notify users of temporary unavailability

**If network timeout:**
```bash
# Increase timeout in code (if needed)
# Check backend/src/routes/ai-*.ts files

# Scale up backend resources
flyctl scale vm dedicated-cpu-1x --memory 2048 -a tynebase-backend
```

---

### Issue 5: Authentication Failures

**Symptoms:**
- Users cannot log in
- "Invalid credentials" errors for valid users
- Session expired errors

**Diagnosis:**
```bash
# Check Supabase Auth logs
# Navigate to: Supabase Dashboard → Authentication → Logs

# Check backend logs
flyctl logs -a tynebase-backend | grep -i "auth"

# Verify Supabase API keys
flyctl secrets list -a tynebase-backend
```

**Common Causes:**
1. **Supabase API key rotated** - Old keys no longer valid
2. **RLS policy blocking access** - User doesn't have permission
3. **Email not confirmed** - User hasn't verified email
4. **Supabase service outage** - Auth service down

**Solutions:**

**If API key rotated:**
```bash
# Update to new keys
flyctl secrets set SUPABASE_SECRET_KEY="sb_secret_NEW" -a tynebase-backend
flyctl secrets set SUPABASE_PUBLISHABLE_KEY="sb_publishable_NEW" -a tynebase-backend

# Update frontend as well
# In Vercel dashboard → Settings → Environment Variables
```

**If RLS policy blocking:**
```sql
-- Check user's role
SELECT id, email, role FROM auth.users WHERE email = 'user@example.com';

-- Check RLS policies on users table
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Temporarily disable RLS for debugging (ONLY in development!)
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

**If email not confirmed:**
```sql
-- Manually confirm user (emergency only)
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email = 'user@example.com';
```

**If Supabase outage:**
- Check Supabase Status: https://status.supabase.com/
- Notify users via status page
- Wait for resolution or implement fallback

---

### Issue 6: File Upload Failures

**Symptoms:**
- Document uploads fail with 500 errors
- "Failed to upload file" messages
- Uploads timeout

**Diagnosis:**
```bash
# Check backend logs
flyctl logs -a tynebase-backend | grep -i "upload\|multipart"

# Check Supabase Storage logs
# Navigate to: Supabase Dashboard → Storage → Logs

# Check storage bucket permissions
# Navigate to: Supabase Dashboard → Storage → Policies
```

**Common Causes:**
1. **File size exceeds limit** - File > 500MB
2. **Storage bucket full** - Exceeded storage quota
3. **Invalid file type** - File type not allowed
4. **RLS policy blocking upload** - User lacks permission

**Solutions:**

**If file too large:**
```bash
# Increase limit in backend/src/server.ts
# multipart.limits.fileSize = 1000 * 1024 * 1024; // 1GB

# Redeploy
flyctl deploy -a tynebase-backend
```

**If storage full:**
- Check Supabase Dashboard → Settings → Usage
- Upgrade Supabase plan if needed
- Clean up old/unused files

**If invalid file type:**
- Check allowed types in backend/src/routes/document-assets.ts
- Add new MIME types if needed

**If RLS blocking:**
```sql
-- Check storage policies
SELECT * FROM storage.objects WHERE bucket_id = 'documents';

-- Verify user has access
SELECT * FROM storage.buckets WHERE id = 'documents';
```

---

### Issue 7: High Error Rate

**Symptoms:**
- Error rate > 5% in monitoring
- Multiple 500 errors in logs
- Users reporting various errors

**Diagnosis:**
```bash
# Check error distribution
flyctl logs -a tynebase-backend | grep "ERROR" | head -50

# Check error handler logs
flyctl logs -a tynebase-backend | grep "errorHandler"

# Check specific error types
flyctl logs -a tynebase-backend | grep "500\|502\|503\|504"
```

**Common Causes:**
1. **Recent deployment bug** - New code introduced errors
2. **Database connectivity issues** - Intermittent connection failures
3. **Third-party service outage** - GCP, Supabase, etc.
4. **Resource exhaustion** - CPU/Memory/Disk full

**Solutions:**

**If recent deployment:**
- See [Rollback Procedures](#rollback-procedures)

**If database issues:**
```bash
# Check database health
curl https://YOUR_PROJECT.supabase.co/rest/v1/

# Restart backend to reset connections
flyctl apps restart tynebase-backend
```

**If third-party outage:**
- Check status pages for all services
- Implement circuit breakers if not present
- Notify users of degraded service

**If resource exhaustion:**
```bash
# Check metrics
flyctl metrics -a tynebase-backend

# Scale up
flyctl scale count 2 -a tynebase-backend
flyctl scale vm shared-cpu-1x --memory 1024 -a tynebase-backend
```

---

## Debugging Procedures

### Step 1: Identify the Scope

**Questions to answer:**
- Is this affecting all users or specific users?
- Is this affecting all features or specific features?
- When did this start?
- Was there a recent deployment?

**Commands:**
```bash
# Check recent deployments
flyctl releases -a tynebase-backend

# Check when issue started in logs
flyctl logs -a tynebase-backend --since 1h

# Check specific user's requests
flyctl logs -a tynebase-backend | grep "user_id:USER_ID"
```

### Step 2: Gather Logs

**Backend logs:**
```bash
# Last 100 lines
flyctl logs -a tynebase-backend --limit 100

# Last hour
flyctl logs -a tynebase-backend --since 1h

# Follow in real-time
flyctl logs -a tynebase-backend -f

# Filter for errors
flyctl logs -a tynebase-backend | grep -i "error\|exception\|fail"
```

**Database logs:**
- Supabase Dashboard → Database → Logs → Postgres Logs
- Look for: Connection errors, slow queries, deadlocks

**Frontend logs:**
- Vercel Dashboard → Deployments → [Latest] → Functions
- Browser console errors (ask user for screenshot)

### Step 3: Reproduce the Issue

**In production (careful!):**
```bash
# SSH into backend
flyctl ssh console -a tynebase-backend

# Test specific endpoint
curl -X POST http://localhost:8080/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**In staging/development:**
- Deploy to staging environment
- Reproduce with test data
- Use debugging tools (breakpoints, logging)

### Step 4: Check Dependencies

**Supabase:**
```bash
# Test connection
curl https://YOUR_PROJECT.supabase.co/rest/v1/

# Check status
# Visit: https://status.supabase.com/
```

**Google Cloud Vertex AI:**
```bash
# Test from backend VM
flyctl ssh console -a tynebase-backend

# Check credentials
echo $GCP_SERVICE_ACCOUNT_JSON | base64 -d | jq .

# Test API call (if gcloud CLI available)
# gcloud auth activate-service-account --key-file=key.json
# gcloud ai models list
```

**Vercel (Frontend):**
```bash
# Check deployment status
vercel ls

# Check logs
vercel logs
```

### Step 5: Isolate the Problem

**Test each layer:**
1. **Database** - Run SQL queries directly in Supabase
2. **Backend** - Test API endpoints with curl
3. **Frontend** - Test in browser with network tab open

**Example:**
```bash
# 1. Test database directly
# In Supabase SQL Editor:
SELECT * FROM documents WHERE tenant_id = 'TENANT_ID' LIMIT 1;

# 2. Test backend API
curl https://tynebase-backend.fly.dev/api/documents \
  -H "Authorization: Bearer TOKEN"

# 3. Test frontend
# Open browser → Network tab → Reproduce issue
```

### Step 6: Form Hypothesis

Based on logs and tests, determine:
- What component is failing?
- Why is it failing?
- What changed recently?

### Step 7: Test Fix

**In staging:**
- Apply potential fix
- Test thoroughly
- Monitor for 15-30 minutes

**In production (if critical):**
- Apply minimal fix
- Monitor closely
- Be ready to rollback

---

## Rollback Procedures

### When to Rollback

Rollback immediately if:
- Error rate > 10%
- Critical functionality broken
- Data corruption detected
- Security vulnerability introduced
- Performance degraded > 50%

### Backend API Rollback

**Option 1: Rollback to Previous Release (Fastest)**

```bash
# List recent releases
flyctl releases -a tynebase-backend

# Example output:
# VERSION  STATUS    DESCRIPTION                          USER      DATE
# v12      complete  Deploy image                         ops       2026-01-26
# v11      complete  Deploy image                         ops       2026-01-25
# v10      complete  Deploy image                         ops       2026-01-24

# Rollback to previous version (v11)
flyctl releases rollback v11 -a tynebase-backend

# Verify rollback
flyctl status -a tynebase-backend
flyctl logs -a tynebase-backend
```

**Option 2: Redeploy Previous Git Commit**

```bash
# Find last working commit
git log --oneline -10

# Checkout that commit
git checkout COMMIT_HASH

# Redeploy
flyctl deploy -a tynebase-backend

# Return to main branch
git checkout main
```

**Option 3: Rollback Specific Secret**

```bash
# If issue is due to secret change
# Set back to previous value
flyctl secrets set KEY="OLD_VALUE" -a tynebase-backend

# App will restart automatically
```

**Verification:**
```bash
# Check health endpoint
curl https://tynebase-backend.fly.dev/health

# Check error rate in logs
flyctl logs -a tynebase-backend | grep -i "error" | wc -l

# Monitor for 5-10 minutes
flyctl logs -a tynebase-backend -f
```

### Collaboration Server Rollback

```bash
# Same process as backend
flyctl releases -a tynebase-collab
flyctl releases rollback vXX -a tynebase-collab

# Verify WebSocket connectivity
wscat -c wss://tynebase-collab.fly.dev
```

### Frontend Rollback (Vercel)

**Via Vercel Dashboard:**
1. Go to: https://vercel.com/dashboard
2. Select project: `tynebase-frontend`
3. Go to: Deployments
4. Find last working deployment
5. Click: ⋯ → Promote to Production

**Via Vercel CLI:**
```bash
# List deployments
vercel ls

# Promote specific deployment
vercel promote DEPLOYMENT_URL
```

### Database Rollback

⚠️ **WARNING:** Database rollbacks are complex and risky!

**Option 1: Rollback Migration (If just applied)**

```bash
# List migrations
npx supabase migration list

# Create down migration
# Manually create SQL to undo changes

# Apply down migration
npx supabase db push
```

**Option 2: Point-in-Time Recovery (PITR)**

⚠️ **ONLY for critical data corruption**

1. Go to: Supabase Dashboard → Database → Backups
2. Select: Point-in-Time Recovery
3. Choose: Timestamp before issue
4. Click: Restore

**Note:** This will restore ENTIRE database to that point. All data after that timestamp will be lost!

**Option 3: Restore from Backup**

1. Go to: Supabase Dashboard → Database → Backups
2. Download: Latest backup before issue
3. Create: New Supabase project
4. Restore: Backup to new project
5. Update: Backend to point to new project
6. Migrate: Users to new project

### Post-Rollback Actions

1. **Verify system health:**
   ```bash
   # Check all health endpoints
   curl https://tynebase-backend.fly.dev/health
   curl https://tynebase.vercel.app
   ```

2. **Monitor error rates:**
   ```bash
   # Watch logs for 15-30 minutes
   flyctl logs -a tynebase-backend -f
   ```

3. **Notify stakeholders:**
   - Update status page
   - Send notification to users (if needed)
   - Post in team chat

4. **Document incident:**
   - What happened?
   - What was the root cause?
   - What was rolled back?
   - What's the plan to fix properly?

5. **Create fix plan:**
   - Identify root cause
   - Develop proper fix
   - Test in staging
   - Schedule deployment

---

## Incident Response

### Incident Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P0 - Critical** | Complete service outage | 15 minutes | Backend down, database unavailable |
| **P1 - High** | Major functionality broken | 1 hour | Auth broken, AI generation failing |
| **P2 - Medium** | Degraded performance | 4 hours | Slow responses, intermittent errors |
| **P3 - Low** | Minor issues | 24 hours | UI bugs, non-critical features |

### P0 - Critical Incident Response

**Immediate Actions (0-15 minutes):**

1. **Acknowledge incident:**
   ```bash
   # Post in team chat
   "🚨 P0 INCIDENT: [Brief description]
   Status: Investigating
   On-call: [Your name]
   Started: [Timestamp]"
   ```

2. **Check system status:**
   ```bash
   # All health checks
   curl https://tynebase-backend.fly.dev/health
   curl https://tynebase.vercel.app
   
   # Check Fly.io status
   flyctl status -a tynebase-backend
   flyctl status -a tynebase-collab
   ```

3. **Gather initial logs:**
   ```bash
   flyctl logs -a tynebase-backend --limit 200 > incident-backend.log
   flyctl logs -a tynebase-collab --limit 200 > incident-collab.log
   ```

4. **Determine scope:**
   - All users affected or subset?
   - All features or specific features?
   - Started when?

**Investigation (15-30 minutes):**

5. **Check recent changes:**
   ```bash
   # Recent deployments
   flyctl releases -a tynebase-backend
   
   # Recent commits
   git log --oneline -10
   ```

6. **Check dependencies:**
   - Supabase: https://status.supabase.com/
   - Google Cloud: https://status.cloud.google.com/
   - Fly.io: https://status.flyio.net/
   - Vercel: https://www.vercel-status.com/

7. **If recent deployment caused it:**
   - Execute [Rollback Procedures](#rollback-procedures)
   - Skip to verification

**Resolution (30-60 minutes):**

8. **Apply fix or rollback:**
   - If cause identified → Apply targeted fix
   - If cause unclear → Rollback to last known good state

9. **Verify resolution:**
   ```bash
   # Check health
   curl https://tynebase-backend.fly.dev/health
   
   # Monitor error rate
   flyctl logs -a tynebase-backend -f
   
   # Test critical paths
   # - User login
   # - Document creation
   # - AI generation
   ```

10. **Monitor for 30 minutes:**
    - Watch logs continuously
    - Check error rates
    - Verify user reports

**Post-Incident (1-24 hours):**

11. **Update status:**
    ```bash
    "✅ RESOLVED: [Brief description]
    Duration: [X minutes]
    Root cause: [Brief explanation]
    Resolution: [What was done]
    Post-mortem: [Link to doc]"
    ```

12. **Write post-mortem:**
    - Timeline of events
    - Root cause analysis
    - What went well
    - What could be improved
    - Action items to prevent recurrence

### P1 - High Severity Response

Follow similar process but with 1-hour response time:
- Acknowledge within 15 minutes
- Investigate and fix within 1 hour
- Less urgency for rollback
- Can take time to implement proper fix

### P2/P3 - Lower Severity Response

- Acknowledge within 4-24 hours
- Create ticket for tracking
- Fix during normal business hours
- No need for immediate rollback

### Incident Communication Template

**Initial Notification:**
```
🚨 INCIDENT DETECTED

Severity: P0 / P1 / P2 / P3
Component: Backend / Frontend / Database / AI
Impact: [Description of user impact]
Status: Investigating / Identified / Fixing / Monitoring
ETA: [Estimated time to resolution]
On-call: [Name]
Started: [Timestamp]
```

**Update Notification:**
```
📊 INCIDENT UPDATE

Status: [Current status]
Progress: [What's been done]
Next steps: [What's next]
ETA: [Updated ETA]
Updated: [Timestamp]
```

**Resolution Notification:**
```
✅ INCIDENT RESOLVED

Duration: [Total time]
Root cause: [Brief explanation]
Resolution: [What fixed it]
Monitoring: [How long we'll monitor]
Post-mortem: [Link or ETA]
Resolved: [Timestamp]
```

---

## Database Operations

### Routine Maintenance

**Weekly Tasks:**
```sql
-- Vacuum and analyze tables
VACUUM ANALYZE documents;
VACUUM ANALYZE document_embeddings;
VACUUM ANALYZE audit_logs;
VACUUM ANALYZE query_usage;

-- Check table bloat
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

**Monthly Tasks:**
```sql
-- Reindex tables (during maintenance window)
REINDEX TABLE documents;
REINDEX TABLE document_embeddings;

-- Update statistics
ANALYZE;

-- Check for missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
AND correlation < 0.1;
```

### Backup Verification

**Weekly:**
```bash
# Verify backups exist in Supabase Dashboard
# Navigate to: Database → Backups

# Test restore process (in staging)
# 1. Download latest backup
# 2. Create test project
# 3. Restore backup
# 4. Verify data integrity
```

### Database Migrations

**Pre-Migration Checklist:**
- [ ] Migration tested in development
- [ ] Migration tested in staging
- [ ] Backup created before migration
- [ ] Rollback plan documented
- [ ] Maintenance window scheduled
- [ ] Users notified (if downtime)

**Migration Process:**
```bash
# 1. Create backup
# In Supabase Dashboard → Database → Backups → Create Backup

# 2. Apply migration
npx supabase db push

# 3. Verify migration
npx supabase migration list

# 4. Test application
curl https://tynebase-backend.fly.dev/health

# 5. Monitor for issues
flyctl logs -a tynebase-backend -f
```

**Post-Migration:**
```sql
-- Verify schema changes
\d+ table_name

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Test queries
SELECT * FROM new_table LIMIT 1;
```

### Emergency Database Access

**Read-Only Access:**
```bash
# Use Supabase SQL Editor
# Navigate to: Supabase Dashboard → SQL Editor

# Run read-only queries
SELECT * FROM users WHERE email = 'user@example.com';
```

**Write Access (Emergency Only):**
```sql
-- Update user data
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';

-- Fix data corruption
UPDATE documents SET status = 'published' WHERE id = 'DOC_ID';

-- Delete spam/malicious data
DELETE FROM documents WHERE tenant_id = 'SPAM_TENANT_ID';
```

⚠️ **Always:**
- Document what you changed
- Notify team immediately
- Create ticket for proper fix
- Review in post-mortem

---

## Performance Troubleshooting

### Slow API Responses

**Diagnosis:**
```bash
# Check response times
flyctl metrics -a tynebase-backend

# Check slow endpoints in logs
flyctl logs -a tynebase-backend | grep "duration"

# Check database performance
# Supabase Dashboard → Database → Performance
```

**Common Fixes:**

1. **Add database indexes:**
   ```sql
   CREATE INDEX CONCURRENTLY idx_name ON table(column);
   ```

2. **Optimize queries:**
   ```sql
   -- Use EXPLAIN ANALYZE to find slow queries
   EXPLAIN ANALYZE SELECT * FROM documents WHERE tenant_id = 'ID';
   ```

3. **Enable caching:**
   - Implement Redis for frequently accessed data
   - Cache AI generation results
   - Cache user sessions

4. **Scale resources:**
   ```bash
   flyctl scale count 2 -a tynebase-backend
   flyctl scale vm dedicated-cpu-1x --memory 2048 -a tynebase-backend
   ```

### High Memory Usage

**Diagnosis:**
```bash
# Check memory metrics
flyctl metrics -a tynebase-backend

# Check for memory leaks in logs
flyctl logs -a tynebase-backend | grep -i "memory\|heap"

# SSH and check process
flyctl ssh console -a tynebase-backend
top
```

**Common Fixes:**

1. **Increase memory:**
   ```bash
   flyctl scale vm shared-cpu-1x --memory 1024 -a tynebase-backend
   ```

2. **Fix memory leaks:**
   - Review recent code changes
   - Check for unclosed connections
   - Check for large objects in memory

3. **Optimize file processing:**
   - Use streaming for large files
   - Process in chunks
   - Clean up temporary files

### High CPU Usage

**Diagnosis:**
```bash
# Check CPU metrics
flyctl metrics -a tynebase-backend

# Check CPU-intensive operations
flyctl logs -a tynebase-backend | grep -i "cpu\|processing"
```

**Common Fixes:**

1. **Optimize algorithms:**
   - Review CPU-intensive code
   - Use more efficient algorithms
   - Offload to background workers

2. **Scale horizontally:**
   ```bash
   flyctl scale count 3 -a tynebase-backend
   ```

3. **Upgrade CPU:**
   ```bash
   flyctl scale vm dedicated-cpu-1x -a tynebase-backend
   ```

---

## Security Incidents

### Suspected Breach

**Immediate Actions:**

1. **Isolate affected systems:**
   ```bash
   # If backend compromised, scale down to 0
   flyctl scale count 0 -a tynebase-backend
   
   # Or restrict access via firewall
   # (Configure in Fly.io dashboard)
   ```

2. **Preserve evidence:**
   ```bash
   # Save all logs
   flyctl logs -a tynebase-backend --limit 10000 > breach-logs.txt
   
   # Save database state
   # Supabase Dashboard → Database → Backups → Create Backup
   ```

3. **Rotate all credentials:**
   ```bash
   # Rotate Supabase keys
   # 1. Generate new keys in Supabase Dashboard
   # 2. Update Fly.io secrets
   flyctl secrets set SUPABASE_SECRET_KEY="NEW_KEY" -a tynebase-backend
   
   # Rotate GCP service account
   # 1. Create new service account in GCP Console
   # 2. Update Fly.io secret
   flyctl secrets set GCP_SERVICE_ACCOUNT_JSON="NEW_KEY" -a tynebase-backend
   
   # Invalidate all user sessions
   # In Supabase SQL Editor:
   DELETE FROM auth.sessions;
   ```

4. **Notify stakeholders:**
   - Security team
   - Management
   - Legal (if required)
   - Affected users (if confirmed)

### Suspicious Activity

**Investigation:**
```bash
# Check for unusual API calls
flyctl logs -a tynebase-backend | grep -i "401\|403\|429"

# Check for SQL injection attempts
flyctl logs -a tynebase-backend | grep -i "select\|union\|drop\|insert"

# Check for unusual user activity
# In Supabase SQL Editor:
SELECT user_id, action, COUNT(*) as count
FROM audit_logs
WHERE created_at > now() - interval '1 hour'
GROUP BY user_id, action
ORDER BY count DESC;
```

**Response:**
```bash
# Block suspicious IP (if identified)
# Configure in Fly.io dashboard or via firewall rules

# Suspend suspicious user
# In Supabase SQL Editor:
UPDATE users SET status = 'suspended' WHERE id = 'USER_ID';

# Review and strengthen RLS policies
# Check pg_policies for gaps
```

### Data Leak

**Immediate Actions:**

1. **Identify scope:**
   - What data was exposed?
   - How many users affected?
   - How was it exposed?

2. **Stop the leak:**
   - Fix the vulnerability
   - Deploy immediately
   - Verify fix

3. **Notify affected users:**
   - Email notification
   - Recommend password change
   - Offer support

4. **Document incident:**
   - Timeline
   - Data exposed
   - Users affected
   - Actions taken
   - Lessons learned

---

## Maintenance Windows

### Scheduled Maintenance

**Planning:**
- Schedule during low-traffic hours (typically 2-4 AM local time)
- Notify users 48 hours in advance
- Prepare rollback plan
- Test in staging first

**Notification Template:**
```
📅 SCHEDULED MAINTENANCE

Date: [Date]
Time: [Start time] - [End time] (UTC)
Duration: [Estimated duration]
Impact: [Expected impact]
Reason: [Why maintenance is needed]

During this time:
- [List of affected features]
- [What will still work]

We apologize for any inconvenience.
```

**Execution:**
```bash
# 1. Enable maintenance mode (if available)
# Update status page

# 2. Create backup
# Supabase Dashboard → Database → Backups

# 3. Perform maintenance
# - Apply database migrations
# - Deploy new code
# - Update configurations

# 4. Verify changes
curl https://tynebase-backend.fly.dev/health

# 5. Monitor for 30 minutes
flyctl logs -a tynebase-backend -f

# 6. Disable maintenance mode
# Update status page
```

### Emergency Maintenance

**When needed:**
- Critical security patch
- Data corruption fix
- Service outage resolution

**Process:**
```bash
# 1. Notify users immediately
"⚠️ EMERGENCY MAINTENANCE
We are performing emergency maintenance to resolve [issue].
Expected duration: [X minutes]
Status updates: [Link]"

# 2. Execute fix quickly
# Follow standard deployment or rollback procedures

# 3. Verify and monitor
# Test critical paths
# Watch error rates

# 4. Update users
"✅ MAINTENANCE COMPLETE
Service has been restored.
Thank you for your patience."
```

---

## Escalation Procedures

### When to Escalate

Escalate if:
- Unable to resolve within SLA
- Issue requires specialized knowledge
- Multiple systems affected
- Data loss or corruption suspected
- Security breach suspected
- Legal/compliance implications

### Escalation Contacts

**Level 1: On-Call Engineer**
- Response time: 15 minutes
- Handles: Common issues, deployments, rollbacks

**Level 2: Senior Engineer / Tech Lead**
- Response time: 30 minutes
- Handles: Complex technical issues, architecture decisions

**Level 3: Engineering Manager**
- Response time: 1 hour
- Handles: Resource allocation, vendor escalations

**Level 4: CTO / VP Engineering**
- Response time: 2 hours
- Handles: Critical business impact, executive decisions

### External Escalations

**Supabase Support:**
- Email: support@supabase.com
- Dashboard: Support → New Ticket
- Priority: Critical / High / Medium / Low

**Google Cloud Support:**
- Console: Support → Create Case
- Phone: [Your support number]
- Priority: P1 / P2 / P3 / P4

**Fly.io Support:**
- Community: https://community.fly.io
- Email: support@fly.io
- Emergency: (for paid plans)

---

## Appendix

### Useful Commands Reference

**Fly.io:**
```bash
# Status and monitoring
flyctl status -a APP_NAME
flyctl metrics -a APP_NAME
flyctl logs -a APP_NAME
flyctl logs -a APP_NAME -f

# Deployment
flyctl deploy -a APP_NAME
flyctl releases -a APP_NAME
flyctl releases rollback vXX -a APP_NAME

# Scaling
flyctl scale count N -a APP_NAME
flyctl scale vm TYPE --memory MB -a APP_NAME

# Secrets
flyctl secrets list -a APP_NAME
flyctl secrets set KEY=VALUE -a APP_NAME

# Debugging
flyctl ssh console -a APP_NAME
flyctl proxy PORT:PORT -a APP_NAME
```

**Supabase:**
```bash
# Migrations
npx supabase db push
npx supabase migration list
npx supabase db reset

# Status
npx supabase status
npx supabase projects list
```

**Git:**
```bash
# History
git log --oneline -10
git show COMMIT_HASH

# Rollback
git checkout COMMIT_HASH
git revert COMMIT_HASH
```

### Health Check Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Backend API | `https://tynebase-backend.fly.dev/health` | `{"status":"ok"}` |
| Frontend | `https://tynebase.vercel.app` | 200 OK |
| Supabase | `https://PROJECT.supabase.co/rest/v1/` | 200 OK |

### Important Links

- **Fly.io Dashboard:** https://fly.io/dashboard
- **Supabase Dashboard:** https://app.supabase.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GCP Console:** https://console.cloud.google.com
- **Status Pages:**
  - Fly.io: https://status.flyio.net/
  - Supabase: https://status.supabase.com/
  - Vercel: https://www.vercel-status.com/
  - Google Cloud: https://status.cloud.google.com/

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-26  
**Maintained By:** TyneBase Operations Team  
**Review Schedule:** Quarterly
