# TyneBase — Technical Specification
**Version 1.0 | April 2026 | Confidential**

---

## Overview

TyneBase is a multi-tenant enterprise knowledge platform that combines real-time collaborative document editing, AI-powered content generation, and a RAG-based intelligent search engine — all within a fully isolated, GDPR-compliant infrastructure. Each client organisation receives its own secure instance at `{subdomain}.tynebase.com` with dedicated storage, branding, and configurable AI preferences.

---

## Platform Architecture

### Deployment Model

| Layer | Technology | Host |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 | Vercel (global edge) |
| API Server | Node.js 20 + Fastify 5 (TypeScript) | Fly.io |
| Collaboration Server | Hocuspocus (WebSocket, port 8081) | Fly.io |
| Worker Process | Async job queue processor | Fly.io |
| Database | Supabase PostgreSQL + pgvector | AWS (eu-west-2) |
| Object Storage | Supabase Storage (per-tenant buckets) | AWS (eu-west-2) |
| AI Inference (text) | AWS Bedrock (London region) | AWS (eu-west-2) |
| AI Inference (media) | Google Vertex AI (London region) | GCP (europe-west2) |

All AI inference, database storage, and object storage operate within UK/EU data centres. No client data is processed outside these regions.

### Multi-Tenancy Architecture

TyneBase enforces **4-layer tenant isolation**:

1. **DNS routing** — Each tenant is accessed via a unique subdomain. The API validates the subdomain on every request before processing.
2. **Application middleware** — A tenant context middleware resolves and attaches the tenant to every request. Requests without a valid tenant context are rejected immediately.
3. **Database Row-Level Security (RLS)** — PostgreSQL RLS policies are enforced at the database level, ensuring queries from one tenant can never read or modify another tenant's rows — even if application-layer checks were bypassed.
4. **Object storage isolation** — Each tenant writes to its own dedicated Supabase Storage bucket. Access is granted exclusively through signed URLs scoped to the tenant.

---

## Core Feature Modules

### 1. Document Editor & Knowledge Base

- Rich-text editor built on TipTap (ProseMirror) with full markdown support
- Hierarchical document structure (nested folders and documents)
- Document status workflow: `draft → published`
- Public/private visibility controls
- Document versioning and lineage tracking
- Export to PDF, DOCX, and Markdown
- Document sharing via secure external links

### 2. Real-Time Collaboration

- Simultaneous multi-user editing using **Y.js CRDT** (Conflict-free Replicated Data Types)
- Hocuspocus WebSocket server manages session state and synchronisation
- Document CRDT state is persisted to the database — no data lost on disconnect
- Inline formatting (bold, italic, code, links, tables, task lists) synced in real time

### 3. AI Content Generation

TyneBase integrates three AI models accessible through a unified credit-based interface:

| Model | Provider | Use Case | Credits per Op |
|---|---|---|---|
| DeepSeek v3 | AWS Bedrock (eu-west-2) | General text generation | 1 credit |
| Gemini 2.5 Flash | Google Vertex (europe-west2) | Video/audio transcription | 2 credits |
| Claude Sonnet 4.5 | AWS Bedrock (eu-west-2) | High-quality generation | 4 credits |

**AI Operations available:**
- Prompt-based document generation from scratch
- Enhancement of existing documents (tone, structure, completeness)
- RAG-powered conversational chat against the tenant's knowledge base (streaming)
- Web URL scraping to Markdown
- GDPR consent gate — users must explicitly consent to AI processing before any AI feature is accessible

### 4. Media Ingestion & Transcription

- **Video upload** (up to 500 MB) → stored in tenant bucket → transcribed to document via Gemini
- **YouTube video import** by URL → downloaded via yt-dlp sidecar → transcribed
- **Audio upload** → transcribed to document
- **Document import** — converts PDF, DOCX, and HTML files to editable Markdown via the editor
- All media processing is async (job queue) with real-time progress notifications

### 5. RAG Search Engine

TyneBase implements a **hybrid semantic search** pipeline:

```
Document published
   → Semantic chunking (structure-aware, context-preserved)
   → Cohere Embed v4.0 (1536-dim vectors, via AWS Bedrock)
   → Stored in pgvector (Supabase)

User query
   → Hybrid search: vector similarity + PostgreSQL full-text ranking
   → Top 50 candidates → Cohere Rerank v3.5 → Top 10 results
   → Returned with source citations
```

The RAG chat endpoint streams responses in real time with source attribution.

### 6. Team Chat & Discussions

- **Channels** — default `#general`, `#announcements`, `#random` + custom channels
- Real-time messaging via Supabase Realtime (WebSocket)
- Message reactions, threads, pinned messages
- Unread counts tracked per user per channel
- **Direct Messages** — 1-on-1 user messaging
- **Discussions** — structured forum threads with nested replies, likes, and asset attachments

### 7. Templates & Collections

- **Templates** — reusable document structures, available tenant-wide or submitted to the global marketplace (admin approval required)
- **Collections** — curated document groups by topic
- **Categories** and **Tags** — flexible content taxonomy for discovery

### 8. User & Role Management

| Role | Capabilities |
|---|---|
| Admin | Full tenant configuration, invite/remove users, billing, branding |
| Editor | Create, edit, publish all documents |
| Contributor | Create and edit own documents |
| View Only | Read-only access |
| Super Admin | Platform-level access (TyneBase operators only) |

**Invitation flow:** Admin enters email → Supabase magic link sent via Resend → User sets password → Granted role access. Pending invites are tracked and can be resent or cancelled.

### 9. Notifications

- In-app notification feed, updated in real time via Supabase Realtime
- Email notifications via Resend (transactional)
- Notification types: document activity, mentions, invite acceptances, job completions

### 10. Billing & Credits

- Subscription tiers managed through **Stripe** (Base, Pro, Enterprise)
- Credit packs purchasable on-demand via Stripe Checkout
- All AI operations deduct from the tenant's credit balance at the point of use
- Usage tracked per model, per user, per tenant for billing and analytics
- Stripe webhook handling with signature verification

---

## Compliance & Security

### Data Residency

All data is stored and processed within UK/EU regions (AWS eu-west-2, GCP europe-west2). No data transits to US-based infrastructure.

### GDPR Features

| Feature | Implementation |
|---|---|
| Consent management | Granular opt-in for analytics, AI processing, and knowledge base indexing |
| Data portability | Full JSON export of all user data on demand |
| Right to erasure | Account deletion job cascades all personal data asynchronously |
| Audit logs | Immutable event log for every document action, AI operation, and user change |
| Data minimisation | Only data necessary for the operation is collected |

### Authentication & Authorisation

- JWT-based authentication via Supabase Auth
- HTTPS enforced across all endpoints (Fly.io TLS termination)
- CORS locked to `*.tynebase.com` and explicit allowed origins
- Rate limiting:
  - Global API: 100 requests / 10 minutes
  - Login: 5 attempts / 15 minutes per IP
  - AI endpoints: 10 requests / minute
- Helmet.js Content Security Policy headers on all responses

### Certifications (Planned/Active)

- GDPR compliant (data residency + consent + erasure)
- SOC 2 Type II (in progress)
- HIPAA BAA available (Enterprise tier)

---

## Observability & Reliability

- **Structured logging** — Pino with optional Axiom backend
- **Health checks** — `/health` endpoint polled every 30 seconds by Fly.io
- **Auto-scaling** — Fly.io scales API machines (1–3) based on load
- **Worker resilience** — Job claims are locked by worker ID; failed jobs are retried with error state recorded
- **Collaboration server** — Runs as an independent process, isolated from API failures

---

## Key Integrations Summary

| Integration | Role |
|---|---|
| Stripe | Subscription billing, credit pack purchases, webhook events |
| Supabase Auth | User authentication, JWT issuance, magic links |
| AWS Bedrock (eu-west-2) | DeepSeek v3, Claude Sonnet 4.5, Cohere Embed + Rerank |
| Google Vertex AI (europe-west2) | Gemini 2.5 Flash (video/audio transcription) |
| Resend | Transactional email (invites, notifications) |
| Hocuspocus | Real-time collaborative editing WebSocket server |
| Supabase Realtime | In-app live notifications and chat |
| Tavily | Web URL → Markdown scraping |
| FFmpeg | Server-side media encoding |
| yt-dlp (sidecar) | YouTube video download and processing |

---

## Demo Environment

For client demonstrations, a dedicated demo tenant is provisioned at `demo.tynebase.com`. The demo environment includes:

- Pre-populated knowledge base with sample documents, templates, and collections
- Sample team members across all permission roles
- Pre-loaded credits for live AI generation and RAG search demonstrations
- Full feature access including media ingestion, real-time collaboration, and chat

Demo credentials and environment access are provided separately under NDA.

---

*This document is confidential and intended for prospective clients and technical evaluators only. Feature availability may vary by subscription tier. For integration queries or architecture deep-dives, contact the TyneBase team.*
