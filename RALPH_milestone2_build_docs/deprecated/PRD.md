🎯 TyneBase Backend PRD v6.1

Milestone 2 – AI Knowledge Engine (Scope-Locked)

Purpose of This Document

This PRD defines Milestone 2 for TyneBase: the delivery of a production-grade, multi-tenant AI knowledge engine.

This milestone is intentionally scoped to build the core backend primitives required for:

Secure multi-tenant knowledge storage

AI-assisted content generation and ingestion

Retrieval-augmented generation (RAG)

Asynchronous processing of long-running AI jobs

Real-time collaborative document editing

Compliance, auditability, and operational observability

Milestone 2 does not aim to deliver the full end-user product experience. Instead, it establishes the foundational engine upon which higher-level workflows, UX affordances, and governance features will be built in subsequent milestones.

Explicit Scope Boundaries

To eliminate ambiguity, the following distinction is enforced throughout this PRD:

✅ In Scope for Milestone 2

Milestone 2 delivers backend infrastructure and APIs for:

Multi-tenant identity and access control (RLS-enforced)

Document creation, editing, publishing, and lineage tracking

Real-time collaborative editing via Yjs + Hocuspocus

AI-powered content generation, enhancement, and ingestion

Video, PDF, DOCX, URL ingestion and conversion to knowledge

Retrieval-augmented generation with hybrid search and reranking

Credit accounting, rate limiting, and usage logging

Asynchronous job queue and worker processing

GDPR compliance (export, deletion, consent management)

Super admin platform oversight

Structured logging and monitoring

All systems in scope must meet production-level standards for:

Security

Tenant isolation

Data integrity

Observability

Failure handling

❌ Explicitly Out of Scope for Milestone 2

The following product-surface and workflow features are intentionally deferred and must NOT be implemented unless explicitly added later:

Global search / command palette (Cmd+K)

Cross-entity search (users, templates, discussions)

Notification delivery systems (in-app bell, email)

Commenting or discussion threads

User invitations and email-based onboarding flows

Approval workflows and editorial review systems

Content analytics, engagement tracking, or health scoring dashboards

White-label branding configuration beyond persisted settings

Document comparison, diffing, or historical restore UX

These features depend on real user behavior and UX validation and are planned for Milestone 3+ once the core engine is stable and in use.

Design Philosophy

Milestone 2 follows these principles:

Engine First, Experience Later
The backend must be correct, secure, and scalable before UX abstractions are layered on top.

Asynchronous by Default
All AI and ingestion operations are designed as jobs, not blocking requests.

Auditability Over Convenience
Lineage, logging, and traceability are first-class requirements.

Strict Tenant Isolation
Every data path is RLS-protected and tenant-aware.

Solo-Developer Execution
All tasks are designed to be achievable by a single engineer within the milestone timeline.

How to Use This PRD

Tasks must be executed sequentially, phase by phase.

Each task includes:

Action

Validation

Security considerations (where applicable)

No task may be skipped or partially implemented.

If a blocker is encountered:

Mark the task with [!]

Produce a blocker report

Stop execution

This PRD is an execution contract, not a wishlist.

Milestone Transition

Milestone 2 is considered complete only when:

All acceptance criteria are met

No deferred features have leaked into implementation

The system can reliably support Milestone 3 feature expansion without schema rewrites or architectural refactors


# 🎯 TyneBase Backend PRD v6.0 - Milestone 2
**RALPH-Optimized Execution Plan**

---

## Project Context

**Stack:** Next.js 14 (Vercel) + Node.js Fastify (Fly.io) + Supabase (PostgreSQL + Storage) + AI APIs (OpenAI EU, Vertex AI London, AWS Bedrock UK)

**Constraint:** Solo developer, MVP scope, EU data residency

**Timeline:** Milestone 2 - Backend & AI (2 weeks)

**Architecture:**
```
Fly.io Single App (lhr region):
├─ Main API Process (Fastify, port 8080)
└─ Worker Processes (job queue pollers):
   ├─ AI Generation Worker
   ├─ Video Ingestion Worker
   └─ Document Indexing Worker

Separate Fly.io App:
└─ Hocuspocus (real-time collaboration, port 8081)
```

---

## Phase 1: Foundation (Database & Auth)

**Dependencies:** None

### 1.1 [DB] Initialize Supabase Project
- **Action:** Create Supabase project in `eu-west-2` region
- **Validation:** Dashboard accessible, connection string obtained

### 1.2 [DB] Create Core Identity Tables
- **Action:** Create migration file `001_identity.sql`
- **Schema:**
  - `tenants`: id, subdomain (unique index), name, tier, settings (jsonb), storage_limit, credits_total, credits_used, created_at
  - `users`: id (refs auth.users), tenant_id (refs tenants), email, full_name, role, is_super_admin, status, last_active_at
- **Validation:** Run migration, insert test tenant + user

### 1.3 [DB] Enable Row Level Security
- **Action:** Create RLS policies for tenants and users tables
- **Policy Logic:** User can only access rows where `tenant_id` matches their session OR `is_super_admin = true`
- **Validation:** Test with SQL: set session tenant_id, verify isolation

### 1.4 [DB] Create Knowledge Base Tables
- **Action:** Create migration `002_documents.sql`
- **Schema:**
  - `documents`: id, tenant_id, title, content (text/markdown), yjs_state (bytea), parent_id, is_public, status (draft/published), author_id, published_at, last_indexed_at, updated_at
  - `templates`: id, tenant_id (nullable), title, description, content, category, visibility (internal/public), is_approved, created_by, created_at
- **Validation:** Insert test document and template

### 1.5 [DB] Enable pgvector Extension
- **Action:** Run `CREATE EXTENSION vector;`
- **Validation:** Query `SELECT * FROM pg_extension WHERE extname = 'vector';`

### 1.6 [DB] Create Embeddings Table
- **Action:** Create migration `003_embeddings.sql`
- **Schema:**
  - `document_embeddings`: id, document_id (refs documents), tenant_id, chunk_index, chunk_content, embedding (vector(3072)), metadata (jsonb with headers/breadcrumbs), created_at
  - Indexes: HNSW index on embedding column, B-tree on tenant_id
- **Validation:** Insert test embedding vector

### 1.7 [DB] Create Job Queue Infrastructure
- **Action:** Create migration `004_jobs.sql`
- **Schema:**
  - `job_queue`: id, tenant_id, type, status, payload (jsonb), result (jsonb), worker_id, attempts, next_retry_at, created_at, completed_at
  - Status enum: pending, processing, completed, failed
- **Validation:** Insert test job, query with `FOR UPDATE SKIP LOCKED`

### 1.8 [DB] Create Document Lineage Table
- **Action:** Create migration `005_lineage.sql`
- **Schema:**
  - `document_lineage`: id, document_id, event_type, actor_id (nullable), metadata (jsonb), created_at
  - Event types: created, ai_generated, converted_from_video, converted_from_pdf, converted_from_url, published, unpublished, ai_enhanced, edited
- **Validation:** Insert test lineage events

### 1.9 [DB] Create User Consents Table
- **Action:** Create migration `006_consents.sql`
- **Schema:**
  - `user_consents`: user_id (PK), ai_processing (boolean), analytics_tracking (boolean), knowledge_indexing (boolean), updated_at
- **Validation:** Insert test consent record

### 1.10 [DB] Create Credit Tracking Tables
- **Action:** Create migration `007_credits.sql`
- **Schema:**
  - `credit_pools`: tenant_id, month_year (text YYYY-MM), total_credits, used_credits, created_at
  - `query_usage`: id, tenant_id, user_id, query_type, ai_model, tokens_input, tokens_output, credits_charged, created_at
- **Validation:** Insert test credit pool entry

### 1.11 [DB] Create Storage Buckets
- **Action:** Use Supabase dashboard to create buckets: `tenant-uploads`, `tenant-documents`
- **Action:** Set bucket policies to enforce RLS based on tenant_id in file path
- **Validation:** Upload test file, verify RLS blocks cross-tenant access

### 1.12 [DB] Create Hybrid Search RPC
- **Action:** Create SQL function `hybrid_search(query_embedding vector, query_text text, tenant_id uuid, match_count int)`
- **Logic:** Combine vector similarity (70% weight) + full-text ts_rank (30% weight)
- **Validation:** Call function with dummy vector, verify returns ranked results

---

## Phase 2: API Foundation (Fastify)

**Dependencies:** Phase 1

### 2.1 [API] Initialize Fastify Project
- **Action:** Create `backend/` folder, init npm, install: fastify, @fastify/cors, @supabase/supabase-js, dotenv
- **Action:** Create `server.ts` with basic Fastify setup
- **Validation:** `npm run dev` starts server, `curl localhost:8080/health` returns 200

### 2.2 [API] Implement Subdomain Middleware
- **Action:** Create `middleware/tenantContext.ts`
- **Logic:** Extract `x-tenant-subdomain` header → Query Supabase for tenant_id → Store in request.tenant
- **Validation:** curl with header returns tenant info in logs

### 2.3 [API] Implement Auth Middleware
- **Action:** Create `middleware/auth.ts`
- **Logic:** Verify JWT from `Authorization: Bearer` header → Call supabase.auth.getUser() → Store in request.user
- **Validation:** curl with invalid token returns 401

### 2.4 [API] Implement Tenant Membership Guard
- **Action:** Create `middleware/membershipGuard.ts`
- **Logic:** Query users table to verify request.user.id belongs to request.tenant.id OR user.is_super_admin = true
- **Validation:** curl with valid token but wrong subdomain returns 403

### 2.5 [API] Implement In-Memory Rate Limiting
- **Action:** Create `middleware/rateLimit.ts` using Map<userId, timestamps[]>
- **Logic:** Track request timestamps, allow 100 req/10min globally, 10 req/min for /api/ai/* endpoints
- **Validation:** Spam requests, verify 429 returned

### 2.6 [API] Create Credit Guard Middleware
- **Action:** Create `middleware/creditGuard.ts`
- **Logic:** For AI endpoints, query credit_pools to verify (total_credits - used_credits) > 0
- **Validation:** Set credits to 0, call AI endpoint, verify blocked with error message

### 2.7 [API] Implement Auth Endpoints
- **Action:** Create `routes/auth.ts`
- **Endpoints:**
  - POST /api/auth/signup (email, password, tenant_name) → Creates tenant + admin user + buckets
  - POST /api/auth/login (email, password) → Returns JWT
  - GET /api/auth/me → Returns user profile + tenant settings
- **Validation:** Signup creates all DB records, login returns valid JWT

### 2.8 [API] Implement Tenant CRUD Endpoints
- **Action:** Create `routes/tenants.ts`
- **Endpoints:**
  - GET /api/tenants/:id (super admin only)
  - PATCH /api/tenants/:id (update settings, branding, tier)
- **Validation:** Non-admin cannot update tenant, admin can update settings

### 2.9 [API] Implement Document CRUD Endpoints
- **Action:** Create `routes/documents.ts`
- **Endpoints:**
  - GET /api/documents (list with folders, filter by parent_id)
  - GET /api/documents/:id
  - POST /api/documents (create draft)
  - PATCH /api/documents/:id (update content, yjs_state)
  - DELETE /api/documents/:id
  - POST /api/documents/:id/publish
- **Validation:** CRUD operations work, RLS enforced, lineage events created

### 2.10 [API] Implement Template Endpoints
- **Action:** Create `routes/templates.ts`
- **Endpoints:**
  - GET /api/templates (list available templates)
  - POST /api/templates (admin only, set visibility)
  - POST /api/templates/:id/use → Duplicates template as new document
- **Validation:** Use template creates new draft document with copied content

---

## Phase 3: Job Queue & Worker Infrastructure

**Dependencies:** Phase 2

### 3.1 [Worker] Create Worker Entry Point
- **Action:** Create `backend/worker.ts`
- **Logic:** Infinite loop with setInterval(pollJobs, 1000ms)
- **Action:** Create `claimJob()` function using `UPDATE job_queue SET status='processing', worker_id=$1 WHERE id = (SELECT id FROM job_queue WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`
- **Validation:** Start worker, insert test job, verify worker logs "Processing job..."

### 3.2 [Worker] Implement Job Dispatcher Helper
- **Action:** Create `utils/dispatchJob.ts`
- **Logic:** Insert row into job_queue with type, payload, status='pending'
- **Validation:** Call from API route, verify job appears in queue

### 3.3 [Worker] Implement Job Result Handler
- **Action:** Create `utils/completeJob.ts` and `utils/failJob.ts`
- **Logic:** Update job status, result, completed_at or increment attempts + set next_retry_at
- **Validation:** Worker completes job, verify status updated in DB

### 3.4 [Worker] Add Fly.io Configuration
- **Action:** Create `fly.toml` with processes: api (port 8080) and worker (no port)
- **Action:** Create Dockerfile with multi-stage build
- **Validation:** `fly deploy` succeeds, processes show as running

---

## Phase 4: AI Provider Integration

**Dependencies:** Phase 2, Phase 3

### 4.1 [AI] Create AI Provider Router
- **Action:** Create `services/ai/router.ts`
- **Logic:** Route based on tenant preference (stored in tenants.settings.ai_provider)
- **Providers:**
  - OpenAI EU: gpt-5.2 (default for text generation)
  - Anthropic Bedrock UK: claude-sonnet-4.5, claude-opus-4.5 (user selectable)
  - Vertex AI London: gemini-3-flash (video/audio only)
- **Validation:** Mock call to each provider, verify correct endpoint used

### 4.2 [AI] Implement Token Counter
- **Action:** Install `tiktoken`, create `utils/tokenCounter.ts`
- **Logic:** Count tokens in input/output, return count
- **Validation:** Count tokens in sample text, verify accuracy

### 4.3 [AI] Implement Credit Calculator
- **Action:** Create `utils/creditCalculator.ts`
- **Logic:**
  - Text generation: 1 credit per 200k tokens input+output, minimum 1 credit
  - RAG question: 1 credit flat
  - Enhance: 1 credit flat
  - Video ingestion: 1 credit per 5 minutes of video
  - URL/PDF conversion: 1 credit flat
  - Model multipliers: gpt-5.2 (2x), claude-sonnet-4.5 (2x), claude-opus-4.5 (5x)
- **Validation:** Calculate credits for various scenarios, verify against pricing

### 4.4 [AI] Implement OpenAI Integration
- **Action:** Create `services/ai/openai.ts`
- **Logic:** Call `api.eu.openai.com` with streaming support
- **Validation:** Generate text, verify EU endpoint used, stream works

### 4.5 [AI] Implement Anthropic Bedrock Integration
- **Action:** Create `services/ai/anthropic.ts`
- **Logic:** Call AWS Bedrock (eu-west-2) with claude-sonnet-4.5 / opus-4.5
- **Validation:** Generate text, verify UK region used

### 4.6 [AI] Implement Vertex AI Integration
- **Action:** Create `services/ai/vertex.ts`
- **Logic:** Call Vertex AI (europe-west2) with gemini-3-flash for video/audio
- **Validation:** Send test video URL, verify transcription returned

---

## Phase 5: AI Features - Generation & Enhancement

**Dependencies:** Phase 4

### 5.1 [API] Implement "From Prompt" Endpoint
- **Action:** Create POST /api/ai/generate
- **Logic:**
  1. Validate prompt, estimate output tokens
  2. Calculate credits, check availability
  3. Deduct credits atomically
  4. Dispatch job (type: 'ai_generate')
  5. Return job_id
- **Validation:** Call endpoint, verify job queued, credits deducted

### 5.2 [Worker] Implement AI Generation Job Handler
- **Action:** Create `workers/aiGeneration.ts`
- **Logic:**
  1. Call AI provider (based on user selection)
  2. Stream/generate full content
  3. Create document (status: draft)
  4. Create lineage event (type: ai_generated)
  5. Log query_usage with actual tokens
- **Validation:** Worker processes job, document created, lineage tracked

### 5.3 [API] Implement Job Status Polling Endpoint
- **Action:** Create GET /api/jobs/:id
- **Logic:** Return job status, result if completed
- **Validation:** Poll job until completed, verify result contains document_id

### 5.4 [API] Implement Enhance Endpoint
- **Action:** Create POST /api/ai/enhance
- **Logic:**
  1. Get document content
  2. Call AI with prompt: "Analyze completeness, provide score 0-100 and 3-5 specific suggestions"
  3. Return JSON: {score, suggestions: [{type, title, reason, original, suggested}]}
  4. Deduct 1 credit
  5. Log query_usage
- **Validation:** Call with test document, verify suggestions returned in <10s

### 5.5 [API] Implement Apply Suggestion Endpoint
- **Action:** Create POST /api/ai/enhance/:suggestionId/apply
- **Logic:** Call AI to generate suggested content, return for frontend to insert
- **Validation:** Apply suggestion, verify content generated

---

## Phase 6: Video & Document Ingestion

**Dependencies:** Phase 4

### 6.1 [API] Implement Video Upload Endpoint
- **Action:** Create POST /api/ai/video/upload
- **Logic:**
  1. Accept file upload
  2. Upload to Supabase Storage (tenant-uploads bucket)
  3. Dispatch job (type: 'video_ingest', payload: {storage_path})
  4. Return job_id
- **Validation:** Upload video, verify stored in bucket

### 6.2 [Worker] Implement Video Ingestion Job Handler (Gemini)
- **Action:** Create `workers/videoIngest.ts`
- **Logic:**
  1. Get signed URL from Supabase Storage
  2. Get video metadata (duration) using ffprobe or Gemini API
  3. Calculate credits (duration_minutes / 5)
  4. Stream video to Vertex AI Gemini API
  5. Receive transcript with timestamps
  6. Create document with transcript
  7. Create lineage event (type: converted_from_video)
  8. Delete video from storage (optional config)
- **Validation:** Process video, verify transcript in document, credits deducted

### 6.3 [Worker] Implement Fallback Video Processing (yt-dlp + Whisper)
- **Action:** Add to `workers/videoIngest.ts`
- **Logic:** If Gemini API fails (503, timeout), fallback to yt-dlp download + Whisper transcription
- **Validation:** Simulate Gemini failure, verify fallback works

### 6.4 [API] Implement YouTube URL Ingestion
- **Action:** Create POST /api/ai/video/youtube
- **Logic:**
  1. Validate YouTube URL
  2. Dispatch job (type: 'video_ingest_youtube', payload: {url})
  3. Return job_id
- **Validation:** Submit YouTube URL, verify job queued

### 6.5 [Worker] Handle YouTube URL in Video Ingest
- **Action:** Update `workers/videoIngest.ts`
- **Logic:** If payload contains YouTube URL, pass directly to Gemini (supports native YouTube URLs)
- **Validation:** Process YouTube URL, verify transcript generated

### 6.6 [API] Implement PDF/DOCX Upload Endpoint
- **Action:** Create POST /api/documents/import
- **Logic:**
  1. Accept file upload (PDF, DOCX, MD)
  2. Upload to Supabase Storage
  3. Dispatch job (type: 'document_convert')
  4. Return job_id
- **Validation:** Upload PDF, verify job queued

### 6.7 [Worker] Implement Document Conversion Job Handler
- **Action:** Create `workers/documentConvert.ts`
- **Logic:**
  1. Download file from Supabase Storage
  2. Convert to Markdown (use pdf-parse for PDF, mammoth for DOCX)
  3. Create document with markdown content
  4. Create lineage event (type: converted_from_pdf/docx)
  5. Deduct 1 credit
- **Validation:** Convert PDF, verify markdown in document

### 6.8 [API] Implement URL Scraping Endpoint
- **Action:** Create POST /api/ai/scrape
- **Logic:**
  1. Call Tavily API to extract main content
  2. Convert HTML to Markdown
  3. Return markdown to frontend (not auto-saved)
- **Validation:** Scrape URL, verify markdown returned

### 6.9 [API] Implement Integration Import Endpoints
- **Action:** Create POST /api/integrations/notion/import
- **Action:** Create POST /api/integrations/confluence/import
- **Action:** Create POST /api/integrations/gdocs/import
- **Logic:** Each dispatches jobs for OAuth flow + data sync (implementation details deferred to integration setup)
- **Validation:** Endpoint exists, returns 501 Not Implemented (placeholder for Milestone 3)

---

## Phase 7: RAG Pipeline (Chunking, Embedding, Retrieval)

**Dependencies:** Phase 4

### 7.1 [Worker] Implement 4-Pass Chunking Algorithm
- **Action:** Create `services/chunking/fourPass.ts`
- **Logic:**
  1. Structure split by headers (H1, H2, H3)
  2. Semantic split large sections (max 1000 words per chunk)
  3. Merge small orphan chunks (<100 words) with neighbors
  4. Prefix each chunk with "Document: {title} > {header hierarchy}"
- **Validation:** Unit test with complex markdown, verify chunks have context

### 7.2 [Worker] Implement Embedding Job Handler
- **Action:** Create `workers/ragIndex.ts`
- **Logic:**
  1. Get document content
  2. Run 4-pass chunking
  3. Batch chunks (max 100 per API call)
  4. Call OpenAI EU text-embedding-3-large
  5. Insert into document_embeddings
  6. Update documents.last_indexed_at
- **Validation:** Index document, verify embeddings in DB, last_indexed_at updated

### 7.3 [API] Implement Auto-Index on Document Save
- **Action:** Update PATCH /api/documents/:id
- **Logic:** After saving content, dispatch job (type: 'rag_index', payload: {document_id})
- **Validation:** Edit document, verify re-index job queued

### 7.4 [API] Implement RAG Query Endpoint
- **Action:** Create POST /api/ai/chat
- **Logic:**
  1. Check consent (knowledge_indexing must be true)
  2. Deduct 1 credit
  3. Embed query (OpenAI EU)
  4. Call hybrid_search RPC (top 50 chunks)
  5. Call AWS Bedrock Cohere Rerank (top 10 chunks)
  6. If rerank fails, use top 10 from vector search
  7. Build prompt with context
  8. Stream response from selected LLM
  9. Log query_usage
- **Validation:** Ask question, verify streamed response with citations

### 7.5 [API] Implement Query Workspace Endpoint
- **Action:** Create GET /api/documents/:id/normalized
- **Logic:** Return documents.content (normalized markdown)
- **Validation:** Fetch normalized content, verify matches DB

### 7.6 [API] Implement Index Health Endpoint
- **Action:** Create GET /api/sources/health
- **Logic:**
  1. Count total documents
  2. Count indexed documents (last_indexed_at IS NOT NULL)
  3. Count outdated (updated_at > last_indexed_at)
  4. Count failed jobs (type: rag_index, status: failed)
  5. Return stats + list of documents needing re-index
- **Validation:** Call endpoint, verify stats match DB

### 7.7 [API] Implement Manual Re-Index Endpoint
- **Action:** Create POST /api/sources/:id/reindex
- **Logic:** Dispatch rag_index job for document
- **Validation:** Trigger re-index, verify job queued

---

## Phase 8: Real-Time Collaboration (Hocuspocus)

**Dependencies:** Phase 2

### 8.1 [Collab] Initialize Hocuspocus Server
- **Action:** Create separate Fly.io app `tynebase-collab`
- **Action:** Install @hocuspocus/server, create `collab-server.ts`
- **Action:** Configure to run on port 8081
- **Validation:** Deploy, connect via WebSocket client, verify connection

### 8.2 [Collab] Implement onAuthenticate Hook
- **Action:** Add authentication hook to Hocuspocus config
- **Logic:**
  1. Extract token from connection params
  2. Verify JWT with Supabase
  3. Query DB: SELECT 1 FROM documents WHERE id=$1 AND tenant_id=(SELECT tenant_id FROM users WHERE id=$2)
  4. If no match, reject connection
- **Validation:** Connect with invalid token, verify rejected

### 8.3 [Collab] Implement onLoadDocument Hook
- **Action:** Add persistence hook
- **Logic:** Load documents.yjs_state from DB, return to Hocuspocus
- **Validation:** Connect to existing document, verify content loaded

### 8.4 [Collab] Implement onStoreDocument Hook
- **Action:** Add save hook with 2-second debounce
- **Logic:**
  1. Save binary yjs_state to documents.yjs_state
  2. Convert Y.js → Markdown using @tiptap/transformer
  3. Update documents.content
  4. Update documents.updated_at
  5. Dispatch rag_index job if content changed significantly
- **Validation:** Edit via WebSocket, verify DB updated, markdown correct

---

## Phase 9: Super Admin Dashboard

**Dependencies:** Phase 2

### 9.1 [API] Implement Super Admin Auth Guard
- **Action:** Create `middleware/superAdminGuard.ts`
- **Logic:** Verify user.is_super_admin = true
- **Validation:** Non-super-admin gets 403 on super admin routes

### 9.2 [API] Implement Platform Overview Endpoint
- **Action:** Create GET /api/superadmin/overview
- **Logic:** Return aggregated stats:
  - Total tenants, users, documents
  - Active users (last 7 days)
  - Total AI queries this month
  - Total storage used
  - Active worker count
- **Validation:** Call endpoint, verify stats match DB counts

### 9.3 [API] Implement Tenant List Endpoint
- **Action:** Create GET /api/superadmin/tenants
- **Logic:** Return list with: subdomain, name, tier, user count, document count, credits (used/total), last active
- **Validation:** Call endpoint, verify tenant data returned

### 9.4 [API] Implement Tenant Impersonation Endpoint
- **Action:** Create POST /api/superadmin/impersonate/:tenantId
- **Logic:**
  1. Verify super admin
  2. Generate short-lived JWT (1 hour) with impersonated tenant_id
  3. Return new JWT
- **Validation:** Impersonate tenant, use JWT to access tenant data

### 9.5 [API] Implement Tenant Suspend Endpoint
- **Action:** Create POST /api/superadmin/tenants/:id/suspend
- **Logic:** Update tenant status, block all API access for suspended tenants
- **Validation:** Suspend tenant, verify their API calls blocked

### 9.6 [API] Implement Change Tier Endpoint
- **Action:** Create PATCH /api/superadmin/tenants/:id/tier
- **Logic:** Update tenants.tier, recalculate credit_pools.total_credits
- **Validation:** Change tier, verify credits updated

---

## Phase 10: GDPR & Compliance

**Dependencies:** Phase 2

### 10.1 [API] Implement Data Export Endpoint
- **Action:** Create GET /api/gdpr/export
- **Logic:**
  1. Gather all user data (profile, documents, usage logs)
  2. Format as JSON
  3. Return as downloadable file
- **Validation:** Call endpoint, verify complete data returned

### 10.2 [API] Implement Account Deletion Endpoint
- **Action:** Create DELETE /api/gdpr/delete-account
- **Logic:**
  1. Mark user as deleted
  2. Dispatch job (type: 'gdpr_delete')
  3. Worker: Anonymize/delete user data, remove from documents
- **Validation:** Delete account, verify user data removed after job completes

### 10.3 [API] Implement Consent Update Endpoint
- **Action:** Create PATCH /api/user/consents
- **Logic:** Update user_consents table
- **Validation:** Update consent, verify AI features blocked if ai_processing=false

---

## Phase 11: Image/Video Embeds in Documents

**Dependencies:** Phase 2

### 11.1 [API] Implement Image Upload Endpoint
- **Action:** Create POST /api/documents/:id/upload
- **Logic:**
  1. Accept image/video file
  2. Upload to Supabase Storage (tenant-documents bucket)
  3. Return signed URL (7-day expiry)
  4. Frontend inserts URL into TipTap editor
- **Validation:** Upload image, verify URL works in editor

### 11.2 [API] Implement Asset Management Endpoint
- **Action:** Create GET /api/documents/:id/assets
- **Logic:** List all uploaded assets for document from Storage bucket
- **Validation:** List assets, verify matches uploaded files

---

## Phase 12: Logging & Monitoring

**Dependencies:** Phase 1

### 12.1 [Infra] Setup Axiom Integration
- **Action:** Install axiom transport for logging
- **Action:** Configure structured logging (JSON format)
- **Action:** Log all API requests, errors, job completions
- **Validation:** Trigger actions, verify logs appear in Axiom dashboard

### 12.2 [Infra] Add Performance Logging
- **Action:** Log request duration, DB query times, AI API latency
- **Validation:** Analyze logs, identify slow endpoints

### 12.3 [Infra] Add Error Logging
- **Action:** Log all errors with stack traces
- **Validation:** Trigger errors, verify logs appear in Axiom dashboard

---

## Phase 13: Final Integration & Testing

**Dependencies:** All previous phases

### 13.1 [E2E] Test Complete Signup → Generation Flow
- **Action:** Script: signup → login → create document → AI generate → verify document created
- **Validation:** Full flow succeeds, all lineage events recorded
- **Security:** Verify RLS enforced at each step

### 13.2 [E2E] Test Video Ingestion Flow
- **Action:** Upload video → verify transcript → check credits deducted
- **Validation:** Full flow succeeds, document created with transcript
- **Security:** Verify file cleanup, no orphaned data

### 13.3 [E2E] Test RAG Chat Flow
- **Action:** Index documents → ask questions → verify answers use correct context
- **Validation:** Responses cite correct sources, reranking improves results
- **Security:** Verify tenant isolation (no cross-tenant data leakage)

### 13.4 [E2E] Test Real-Time Collaboration
- **Action:** Connect 2 clients to same document, type simultaneously
- **Validation:** Both see each other's changes, no conflicts, persists after disconnect
- **Security:** Verify authentication on connect

### 13.5 [E2E] Test Super Admin Functions
- **Action:** Impersonate tenant → suspend tenant → verify blocked
- **Validation:** All admin functions work, audit trail recorded
- **Security:** Verify non-admin cannot access admin endpoints

### 13.6 [Audit] Performance Baseline
- **Action:** Benchmark key endpoints (document CRUD, RAG query, AI generation)
- **Validation:** P95 latency < 500ms for CRUD, < 5s for RAG, document results
- **Security:** N/A

### 13.7 [Audit] Security Review
- **Action:** Review all endpoints for: SQL injection, XSS, CSRF, auth bypass, RLS gaps
- **Validation:** No vulnerabilities found, document findings
- **Security:** Run automated scanner (npm audit, Snyk)

### 13.8 [Audit] Database Performance Review
- **Action:** Check slow queries, missing indexes, large tables
- **Validation:** All queries < 100ms, indexes exist on foreign keys
- **Security:** N/A

### 13.9 [Docs] Create API Documentation
- **Action:** Generate OpenAPI spec (swagger.json) via Fastify Swagger
- **Action:** Document all endpoints, Generate TypeScript Frontend Client 
- **Validation:** Spec is valid, TS Client matches backend types 1:1, examples work
- **Security:** Mark which endpoints require auth/admin

### 13.10 [Docs] Create Deployment Guide
- **Action:** Document Fly.io deployment steps, env vars, secrets
- **Validation:** Fresh deploy following guide succeeds
- **Security:** Document secret rotation process

### 13.11 [Docs] Create Runbook
- **Action:** Document common issues, debugging steps, rollback procedure
- **Validation:** Runbook is complete and clear
- **Security:** Include incident response procedures

---

## Phase 14: Deferred Product-Surface Features (Post-Milestone 2)

> These features are **explicitly NOT part of Milestone 2**.
> They MUST NOT be partially implemented.
> They exist here to preserve architectural intent and prevent future rewrites.

### 14.1 [API] Implement Commenting & Discussion Threads
- **Action:** Create thread + message models linked to documents and/or blocks
- **Validation:** Threads attach correctly, messages ordered, permissions enforced
- **Security:** Enforce document RLS, prevent cross-tenant mentions

### 14.2 [System] Emit Mention Events
- **Action:** Emit events for @mentions in documents/comments
- **Validation:** Events recorded in event_log with actor + target
- **Security:** No notification delivery in this phase

### 14.3 [Worker] Implement Notification Delivery System
- **Action:** Deliver notifications via in-app and email channels
- **Validation:** Notifications delivered respecting user preferences
- **Security:** Rate-limit delivery, prevent data leakage across tenants

### 14.4 [API] Implement Global / Cross-Entity Search
- **Action:** Unified search across documents, templates, users, discussions
- **Validation:** Results filtered by tenant, role, and object visibility
- **Security:** Enforce object-level permissions on all results

### 14.5 [API] Implement User Invitations & Onboarding
- **Action:** Invite users via tokenized email links with role assignment
- **Validation:** User joins tenant with correct role after acceptance
- **Security:** Expiring tokens, audit all invites and accepts

### 14.6 [Workflow] Implement Approval & Publishing States
- **Action:** Draft → Review → Approved → Published state machine
- **Validation:** Only authorized roles can transition states
- **Security:** Immutable audit trail for all transitions

### 14.7 [Analytics] Implement Content Usage & Health Metrics
- **Action:** Aggregate query hits, freshness, and coverage gaps
- **Validation:** Metrics computed correctly per tenant
- **Security:** Tenant-isolated analytics only

### 14.8 [API/UX] Implement Document Diffing & Restore
- **Action:** Visual diff between versions + restore endpoint
- **Validation:** Restored version matches historical snapshot
- **Security:** Preserve lineage, prevent destructive overwrites

---

## Promotion Rule

- Phase 14 items may only be promoted when a new milestone is declared
- No Phase 14 schema, API, or worker may be implemented implicitly
- Any early dependency must be explicitly justified in a PRD

---

## Acceptance Criteria (Milestone 2 Complete)

- ✅ Fly.io API server responding at api.tynebase.com
- ✅ Users can sign up and create tenants
- ✅ Documents can be created, edited via TipTap, published
- ✅ AI generates documents from prompts (async worker)
- ✅ Video uploads (YouTube, direct) produce transcripts via Gemini
- ✅ PDF/DOCX uploads convert to markdown
- ✅ URL scraping returns markdown
- ✅ RAG retrieves relevant context with reranking
- ✅ Enhance provides completion score + suggestions
- ✅ Templates can be created and used
- ✅ Real-time collaboration works (Hocuspocus)
- ✅ Credits deducted per action, overdraft blocked
- ✅ Document lineage tracks all AI operations
- ✅ Super admin can view stats, impersonate, suspend tenants
- ✅ GDPR export and deletion functional
- ✅ All events logged to Axiom
- ✅ Job queue processing long-running tasks
- ✅ No security vulnerabilities (audit passed)
- ✅ Performance benchmarks met
- ✅ Documentation complete

---

**END OF PRD**

This PRD is your execution map. Pick tasks sequentially, implement, validate, check off. No skipping ahead. No low-level code in the PRD - let the implementing AI figure out the details within each task's constraints.