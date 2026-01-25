# TyneBase API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:8080` (development) | `https://api.tynebase.com` (production)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Multi-Tenancy](#multi-tenancy)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [API Endpoints](#api-endpoints)
7. [OpenAPI Specification](#openapi-specification)
8. [Examples](#examples)

---

## Overview

TyneBase is a multi-tenant knowledge management platform with AI-powered document generation, RAG (Retrieval-Augmented Generation) capabilities, and real-time collaboration features.

### Key Features

- **Multi-tenant architecture** with strict data isolation
- **JWT-based authentication** with role-based access control
- **AI-powered document generation** using Claude, DeepSeek, and Gemini models
- **RAG (Retrieval-Augmented Generation)** with hybrid search (vector + full-text)
- **Real-time collaboration** using Y.js CRDT
- **Asynchronous job processing** for long-running tasks
- **GDPR compliance** with user consent management
- **Credit-based usage tracking** for AI operations

---

## Authentication

Most endpoints require JWT authentication via Bearer token in the `Authorization` header.

### Obtaining a Token

**1. Sign up (create new tenant and admin user):**

```bash
POST /api/auth/signup
Content-Type: application/json

{
  "email": "admin@acme.com",
  "password": "SecurePass123!",
  "tenant_name": "Acme Corporation",
  "subdomain": "acme",
  "full_name": "John Doe"
}
```

**2. Login (get access token):**

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@acme.com",
  "password": "SecurePass123!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "user": { ... },
    "tenant": { ... }
  }
}
```

### Using the Token

Include the access token in the `Authorization` header for all authenticated requests:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Multi-Tenancy

All authenticated endpoints require the `x-tenant-subdomain` header to specify the tenant context:

```bash
x-tenant-subdomain: acme
```

This ensures strict data isolation between tenants. Requests without this header or with an invalid subdomain will be rejected.

---

## Rate Limiting

TyneBase implements rate limiting to prevent abuse:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Global (all endpoints) | 100 requests | 10 minutes |
| Login attempts | 5 requests | 15 minutes per IP |
| AI endpoints | 10 requests | 1 minute |

**Rate Limit Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

**429 Response:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfter": 600
    }
  }
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `INSUFFICIENT_CREDITS` | 403 | Not enough credits for AI operation |
| `CONSENT_REQUIRED` | 403 | User has not consented to AI processing |

---

## API Endpoints

### Health & Status

#### `GET /`
Returns basic API information.

**Response:**
```json
{
  "name": "TyneBase API",
  "version": "1.0.0",
  "status": "running"
}
```

#### `GET /health`
Returns server health status and uptime.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

---

### Authentication

#### `POST /api/auth/signup`
Creates a new tenant and admin user.

**Auth Required:** No

**Request Body:**
```json
{
  "email": "admin@acme.com",
  "password": "SecurePass123!",
  "tenant_name": "Acme Corporation",
  "subdomain": "acme",
  "full_name": "John Doe"
}
```

**Response:** `201 Created`

#### `POST /api/auth/login`
Authenticates user and returns JWT tokens.

**Auth Required:** No  
**Rate Limited:** 5 attempts per 15 minutes per IP

**Request Body:**
```json
{
  "email": "admin@acme.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`

#### `GET /api/auth/me`
Returns current user profile and tenant information.

**Auth Required:** Yes

**Response:** `200 OK`

---

### Tenants

#### `PATCH /api/tenants/{id}`
Updates tenant settings (name, branding, AI preferences).

**Auth Required:** Yes (admin role)

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "settings": {
    "branding": {
      "logo_url": "https://example.com/logo.png",
      "primary_color": "#3B82F6",
      "secondary_color": "#10B981"
    },
    "ai_preferences": {
      "default_provider": "anthropic",
      "default_model": "claude-sonnet-4.5",
      "temperature": 0.7
    }
  }
}
```

**Response:** `200 OK`

---

### Documents

#### `GET /api/documents`
Lists documents with optional filtering and pagination.

**Auth Required:** Yes

**Query Parameters:**
- `parent_id` (optional): Filter by parent document UUID
- `status` (optional): Filter by status (`draft` or `published`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page, max 100 (default: 50)

**Response:** `200 OK`

#### `POST /api/documents`
Creates a new document with status='draft'.

**Auth Required:** Yes

**Request Body:**
```json
{
  "title": "Product Requirements Document",
  "content": "# Overview\n\nThis document describes...",
  "parent_id": "uuid-optional",
  "is_public": false
}
```

**Response:** `201 Created`

#### `GET /api/documents/{id}`
Retrieves a single document by ID.

**Auth Required:** Yes

**Response:** `200 OK`

#### `PATCH /api/documents/{id}`
Updates document content, title, or visibility. Only the author can update.

**Auth Required:** Yes (document author)

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "is_public": true
}
```

**Response:** `200 OK`

#### `DELETE /api/documents/{id}`
Deletes a document. Only the author can delete.

**Auth Required:** Yes (document author)

**Response:** `200 OK`

#### `POST /api/documents/{id}/publish`
Publishes a document (changes status from 'draft' to 'published').

**Auth Required:** Yes (admin or editor role)

**Response:** `200 OK`

---

### Templates

#### `GET /api/templates`
Lists available templates (approved global + tenant's own).

**Auth Required:** Yes

**Query Parameters:**
- `category` (optional): Filter by category
- `visibility` (optional): Filter by visibility (`internal` or `public`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:** `200 OK`

#### `POST /api/templates`
Creates a new template.

**Auth Required:** Yes (admin role)

**Request Body:**
```json
{
  "title": "Meeting Notes Template",
  "description": "Template for meeting notes",
  "content": "# Meeting Notes\n\n## Attendees\n\n## Agenda\n\n## Action Items",
  "category": "productivity",
  "visibility": "internal"
}
```

**Response:** `201 Created`

#### `POST /api/templates/{id}/use`
Creates a new document from a template.

**Auth Required:** Yes

**Response:** `201 Created`

---

### AI Operations

#### `POST /api/ai/generate`
Generates document content from a prompt using AI.

**Auth Required:** Yes  
**Requires:** User consent for AI processing, sufficient credits

**Request Body:**
```json
{
  "prompt": "Write a product requirements document for a mobile app",
  "model": "deepseek-v3",
  "max_tokens": 2000
}
```

**Response:** `200 OK`

**Models Available:**
- `deepseek-v3` (default, most cost-effective)
- `claude-sonnet-4.5` (high quality)
- `gemini-3-flash` (fast)

---

### RAG (Retrieval-Augmented Generation)

#### `POST /api/rag/search`
Performs hybrid search (vector similarity + full-text) across document embeddings.

**Auth Required:** Yes

**Request Body:**
```json
{
  "query": "How do I configure authentication?",
  "limit": 10,
  "use_reranking": true,
  "rerank_top_n": 10
}
```

**Response:** `200 OK`

#### `POST /api/ai/chat`
Performs RAG-enhanced chat with streaming support.

**Auth Required:** Yes

**Request Body:**
```json
{
  "query": "What are the authentication requirements?",
  "max_context_chunks": 10,
  "model": "claude-sonnet-4.5",
  "temperature": 0.7,
  "stream": true
}
```

**Response:** `200 OK` (streaming or complete)

---

### Jobs

#### `GET /api/jobs/{id}`
Retrieves status of an asynchronous job.

**Auth Required:** Yes

**Response:** `200 OK`

**Job Types:**
- `rag_index` - Document indexing for RAG
- `video_ingest` - Video transcription and ingestion
- `document_convert` - Document format conversion
- `url_scrape` - URL content extraction
- `ai_generate` - AI content generation

**Job Statuses:**
- `pending` - Waiting to be processed
- `processing` - Currently being processed
- `completed` - Successfully completed
- `failed` - Failed with error

---

### GDPR & Consent

#### `GET /api/gdpr/consents`
Returns current user's GDPR consent preferences.

**Auth Required:** Yes

**Response:** `200 OK`

#### `PATCH /api/gdpr/consents`
Updates user's GDPR consent preferences.

**Auth Required:** Yes

**Request Body:**
```json
{
  "ai_processing": true,
  "analytics_tracking": true,
  "knowledge_indexing": true
}
```

**Response:** `200 OK`

---

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

**File:** `docs/openapi.yaml`

You can use this specification with:
- **Swagger UI** - Interactive API documentation
- **Postman** - Import and test API endpoints
- **OpenAPI Generator** - Generate client SDKs in various languages

### Viewing with Swagger UI

```bash
# Install Swagger UI
npm install -g swagger-ui-watcher

# Serve the OpenAPI spec
swagger-ui-watcher docs/openapi.yaml
```

Then open `http://localhost:8000` in your browser.

---

## Examples

### Complete Workflow Example

**1. Sign up and get access token:**

```bash
curl -X POST http://localhost:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123!",
    "tenant_name": "Acme Corporation",
    "subdomain": "acme",
    "full_name": "John Doe"
  }'
```

**2. Login:**

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123!"
  }'
```

**3. Create a document:**

```bash
curl -X POST http://localhost:8080/api/documents \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-tenant-subdomain: acme" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Document",
    "content": "# Hello World\n\nThis is my first document."
  }'
```

**4. Generate content with AI:**

```bash
curl -X POST http://localhost:8080/api/ai/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-tenant-subdomain: acme" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a brief introduction to knowledge management",
    "model": "deepseek-v3",
    "max_tokens": 500
  }'
```

**5. Search documents with RAG:**

```bash
curl -X POST http://localhost:8080/api/rag/search \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-tenant-subdomain: acme" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "knowledge management best practices",
    "limit": 10,
    "use_reranking": true
  }'
```

**6. Chat with RAG context:**

```bash
curl -X POST http://localhost:8080/api/ai/chat \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-tenant-subdomain: acme" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the key principles of knowledge management?",
    "max_context_chunks": 10,
    "stream": false
  }'
```

---

## Security Considerations

### Authentication & Authorization

- ✅ **JWT tokens** with expiration (default: 1 hour)
- ✅ **Role-based access control** (admin, editor, member, viewer)
- ✅ **Tenant isolation** enforced at database and API level
- ✅ **Document ownership** verification for updates/deletes
- ✅ **Super admin** flag for platform-wide administration

### Data Protection

- ✅ **RLS (Row Level Security)** on all database tables
- ✅ **Input validation** with Zod schemas
- ✅ **Parameterized queries** to prevent SQL injection
- ✅ **CORS** configuration with allowed origins
- ✅ **Helmet.js** for security headers
- ✅ **Rate limiting** to prevent abuse

### GDPR Compliance

- ✅ **User consent** tracking for AI processing, analytics, and indexing
- ✅ **Consent verification** before AI operations
- ✅ **Audit logging** via document lineage and query usage tables
- ✅ **Data isolation** per tenant

### Credit System

- ✅ **Monthly credit pools** per tenant
- ✅ **Atomic credit deduction** with row-level locking
- ✅ **Usage tracking** for all AI operations
- ✅ **Credit guard middleware** prevents operations when insufficient credits

---

## Support

For API support, please contact:
- **Email:** support@tynebase.com
- **Documentation:** https://docs.tynebase.com
- **GitHub:** https://github.com/tynebase/tynebase

---

**Last Updated:** 2026-01-26  
**API Version:** 1.0.0
