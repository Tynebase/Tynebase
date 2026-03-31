import { DocArticle } from './types';

export const apiReferenceArticles: DocArticle[] = [
  {
    id: 'api-1',
    slug: 'api-overview',
    title: 'API Overview',
    description: 'Introduction to the TyneBase REST API for integrating with your applications.',
    category: 'API Reference',
    readTime: '5 min',
    lastUpdated: '2026-01-10',
    tags: ['api', 'rest', 'integration', 'overview'],
    content: `
# TyneBase API Overview

The TyneBase API enables you to programmatically access and manage your knowledge base.

## Base URL

\`\`\`
https://api.tynebase.com/v1
\`\`\`

For tenant-specific endpoints:
\`\`\`
https://{your-subdomain}.tynebase.com/api/v1
\`\`\`

## Authentication

All API requests require authentication using Bearer tokens:

\`\`\`bash
curl -X GET "https://api.tynebase.com/v1/documents" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"
\`\`\`

### Obtaining API Keys

1. Navigate to **Settings → API Keys**
2. Click **+ Create API Key**
3. Set permissions and expiration
4. Copy the key (shown only once)

### Key Permissions

| Scope | Description |
|-------|-------------|
| \`documents:read\` | Read documents and categories |
| \`documents:write\` | Create, update, delete documents |
| \`users:read\` | Read user information |
| \`users:write\` | Manage users (admin only) |
| \`ai:generate\` | Use AI generation endpoints |
| \`search:query\` | Access search and RAG endpoints |

## Request Format

### Headers

\`\`\`http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
X-Tenant-ID: your-tenant-id (optional, for multi-tenant access)
\`\`\`

### Request Body

JSON format for POST/PUT/PATCH:

\`\`\`json
{
  "title": "API Documentation",
  "content": "# Getting Started\\n\\nWelcome to...",
  "category_id": "cat_abc123",
  "state": "published"
}
\`\`\`

## Response Format

All responses follow a consistent structure:

### Success Response

\`\`\`json
{
  "success": true,
  "data": {
    "id": "doc_abc123",
    "title": "API Documentation",
    "created_at": "2026-01-10T14:30:00Z"
  },
  "meta": {
    "request_id": "req_xyz789"
  }
}
\`\`\`

### Error Response

\`\`\`json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": {
      "field": "title",
      "constraint": "required"
    }
  },
  "meta": {
    "request_id": "req_xyz789"
  }
}
\`\`\`

## Rate Limiting

| Plan | Requests/minute | Requests/day |
|------|----------------:|-------------:|
| Free | 60 | 1,000 |
| Pro | 300 | 10,000 |
| Enterprise | 1,000 | Unlimited |

Rate limit headers:
\`\`\`http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1704891600
\`\`\`

## Pagination

List endpoints support cursor-based pagination:

\`\`\`bash
GET /v1/documents?limit=20&cursor=eyJpZCI6ImRvY18xMjMifQ
\`\`\`

Response includes pagination info:
\`\`\`json
{
  "data": [...],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6ImRvY180NTYifQ",
    "total_count": 150
  }
}
\`\`\`

## SDKs

Official SDKs available:

- **JavaScript/TypeScript**: \`npm install @tynebase/sdk\`
- **Python**: \`pip install tynebase\`
- **Go**: \`go get github.com/tynebase/go-sdk\`
`
  },
  {
    id: 'api-2',
    slug: 'documents-api',
    title: 'Documents API',
    description: 'Create, read, update, and delete documents programmatically.',
    category: 'API Reference',
    readTime: '8 min',
    lastUpdated: '2026-01-10',
    tags: ['api', 'documents', 'crud'],
    content: `
# Documents API

Manage your knowledge base documents through the API.

## List Documents

\`\`\`http
GET /v1/documents
\`\`\`

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| \`limit\` | integer | Results per page (max 100) |
| \`cursor\` | string | Pagination cursor |
| \`category_id\` | string | Filter by category |
| \`state\` | string | Filter by state (draft, published, archived) |
| \`author_id\` | string | Filter by author |
| \`search\` | string | Full-text search |

### Example Request

\`\`\`bash
curl -X GET "https://api.tynebase.com/v1/documents?state=published&limit=10" \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

### Example Response

\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": "doc_abc123",
      "title": "Getting Started Guide",
      "slug": "getting-started-guide",
      "state": "published",
      "category": {
        "id": "cat_xyz",
        "name": "Quick start"
      },
      "author": {
        "id": "usr_123",
        "name": "John Doe"
      },
      "view_count": 1250,
      "created_at": "2026-01-05T10:00:00Z",
      "updated_at": "2026-01-10T14:30:00Z",
      "published_at": "2026-01-06T09:00:00Z"
    }
  ],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6ImRvY180NTYifQ"
  }
}
\`\`\`

## Get Document

\`\`\`http
GET /v1/documents/{document_id}
\`\`\`

### Example Response

\`\`\`json
{
  "success": true,
  "data": {
    "id": "doc_abc123",
    "title": "Getting Started Guide",
    "slug": "getting-started-guide",
    "content": "# Getting Started\\n\\nWelcome to TyneBase...",
    "content_type": "markdown",
    "state": "published",
    "category_id": "cat_xyz",
    "author_id": "usr_123",
    "assigned_to": null,
    "is_public": true,
    "view_count": 1250,
    "helpful_count": 45,
    "current_version": 3,
    "metadata": {
      "tags": ["getting-started", "basics"],
      "reading_time": 5
    },
    "created_at": "2026-01-05T10:00:00Z",
    "updated_at": "2026-01-10T14:30:00Z"
  }
}
\`\`\`

## Create Document

\`\`\`http
POST /v1/documents
\`\`\`

### Request Body

\`\`\`json
{
  "title": "New API Guide",
  "content": "# API Guide\\n\\nThis guide explains...",
  "category_id": "cat_xyz",
  "state": "draft",
  "is_public": false,
  "metadata": {
    "tags": ["api", "integration"]
  }
}
\`\`\`

### Example

\`\`\`bash
curl -X POST "https://api.tynebase.com/v1/documents" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "New API Guide",
    "content": "# API Guide\\n\\nThis guide explains...",
    "category_id": "cat_xyz"
  }'
\`\`\`

## Update Document

\`\`\`http
PATCH /v1/documents/{document_id}
\`\`\`

### Request Body

\`\`\`json
{
  "title": "Updated Title",
  "content": "# Updated Content",
  "state": "published"
}
\`\`\`

## Delete Document

\`\`\`http
DELETE /v1/documents/{document_id}
\`\`\`

**Note**: Deleting a document also removes:
- All versions
- Embeddings from AI index
- Associated comments

For soft delete, set \`state\` to \`archived\` instead.

## Document Versions

### List Versions

\`\`\`http
GET /v1/documents/{document_id}/versions
\`\`\`

### Restore Version

\`\`\`http
POST /v1/documents/{document_id}/versions/{version_number}/restore
\`\`\`
`
  },
  {
    id: 'api-3',
    slug: 'search-api',
    title: 'Search & RAG API',
    description: 'Integrate AI-powered search and question answering into your applications.',
    category: 'API Reference',
    readTime: '7 min',
    lastUpdated: '2026-01-10',
    tags: ['api', 'search', 'rag', 'ai'],
    content: `
# Search & RAG API

Integrate TyneBase's AI-powered search into your applications.

## Semantic Search

\`\`\`http
POST /v1/search
\`\`\`

### Request Body

\`\`\`json
{
  "query": "How do I configure SSO?",
  "limit": 10,
  "filters": {
    "category_ids": ["cat_security"],
    "state": "published"
  },
  "options": {
    "include_content": true,
    "highlight": true
  }
}
\`\`\`

### Response

\`\`\`json
{
  "success": true,
  "data": {
    "results": [
      {
        "document": {
          "id": "doc_sso123",
          "title": "SSO Configuration Guide",
          "slug": "sso-configuration-guide"
        },
        "score": 0.94,
        "highlights": [
          "To <mark>configure SSO</mark>, navigate to Settings..."
        ],
        "content_preview": "This guide walks you through..."
      }
    ],
    "query_embedding_time_ms": 45,
    "search_time_ms": 23
  }
}
\`\`\`

## AI Question Answering (RAG)

\`\`\`http
POST /v1/ask
\`\`\`

### Request Body

\`\`\`json
{
  "question": "What are the steps to set up SSO with Okta?",
  "options": {
    "max_sources": 5,
    "include_sources": true,
    "stream": false
  }
}
\`\`\`

### Response

\`\`\`json
{
  "success": true,
  "data": {
    "answer": "To set up SSO with Okta, follow these steps:\\n\\n1. Navigate to Settings → Security → SSO\\n2. Select 'Okta' as your identity provider\\n3. Copy the provided ACS URL and Entity ID\\n4. In Okta, create a new SAML 2.0 application...\\n\\nFor detailed configuration, see the linked documentation.",
    "sources": [
      {
        "document_id": "doc_sso123",
        "title": "SSO Configuration Guide",
        "relevance_score": 0.96,
        "chunk_text": "To configure Okta SSO..."
      },
      {
        "document_id": "doc_okta456",
        "title": "Okta Integration",
        "relevance_score": 0.89,
        "chunk_text": "Create a new SAML application..."
      }
    ],
    "confidence": 0.92,
    "model": "gpt-5.2",
    "tokens_used": 1847
  }
}
\`\`\`

## Streaming Responses

For real-time AI responses, use streaming:

\`\`\`http
POST /v1/ask
Content-Type: application/json

{
  "question": "Explain our deployment process",
  "options": {
    "stream": true
  }
}
\`\`\`

Response is Server-Sent Events:

\`\`\`
data: {"type": "start", "request_id": "req_123"}

data: {"type": "token", "content": "The"}
data: {"type": "token", "content": " deployment"}
data: {"type": "token", "content": " process"}
...

data: {"type": "sources", "sources": [...]}
data: {"type": "done", "tokens_used": 523}
\`\`\`

## Embeddings API

Generate embeddings for custom integrations:

\`\`\`http
POST /v1/embeddings
\`\`\`

### Request

\`\`\`json
{
  "texts": [
    "How to configure authentication",
    "Deployment best practices"
  ],
  "model": "text-embedding-3-large"
}
\`\`\`

### Response

\`\`\`json
{
  "success": true,
  "data": {
    "embeddings": [
      {
        "index": 0,
        "embedding": [0.0123, -0.0456, ...],
        "tokens": 5
      },
      {
        "index": 1,
        "embedding": [0.0789, -0.0321, ...],
        "tokens": 4
      }
    ],
    "model": "text-embedding-3-large",
    "dimensions": 3072
  }
}
\`\`\`
`
  },
  {
    id: 'api-4',
    slug: 'webhooks',
    title: 'Webhooks',
    description: 'Receive real-time notifications when events occur in your knowledge base.',
    category: 'API Reference',
    readTime: '6 min',
    lastUpdated: '2026-01-10',
    tags: ['api', 'webhooks', 'events', 'integration'],
    content: `
# Webhooks

Receive real-time HTTP notifications when events occur in TyneBase.

## Setting Up Webhooks

### Create a Webhook

1. Go to **Settings → Integrations → Webhooks**
2. Click **+ Add Webhook**
3. Enter your endpoint URL
4. Select events to subscribe to
5. Save and copy the signing secret

### Or via API

\`\`\`http
POST /v1/webhooks
\`\`\`

\`\`\`json
{
  "url": "https:tynebase.com/webhooks/apiv1",
  "events": [
    "document.created",
    "document.published",
    "document.deleted"
  ],
  "secret": "your-signing-secret"
}
\`\`\`

## Event Types

### Document Events

| Event | Description |
|-------|-------------|
| \`document.created\` | New document created |
| \`document.updated\` | Document content changed |
| \`document.published\` | Document state → published |
| \`document.archived\` | Document state → archived |
| \`document.deleted\` | Document permanently deleted |

### User Events

| Event | Description |
|-------|-------------|
| \`user.invited\` | New user invitation sent |
| \`user.joined\` | User accepted invitation |
| \`user.removed\` | User removed from workspace |
| \`user.role_changed\` | User role updated |

### AI Events

| Event | Description |
|-------|-------------|
| \`ai.generation_completed\` | AI document generation finished |
| \`ai.generation_failed\` | AI generation error |
| \`ai.index_updated\` | Document re-indexed for RAG |

## Webhook Payload

\`\`\`json
{
  "id": "evt_abc123xyz",
  "type": "document.published",
  "created_at": "2026-01-10T14:30:00Z",
  "data": {
    "document": {
      "id": "doc_123",
      "title": "Getting Started Guide",
      "slug": "getting-started-guide",
      "state": "published",
      "author_id": "usr_456"
    },
    "previous_state": "draft"
  },
  "tenant": {
    "id": "ten_789",
    "subdomain": "acme"
  }
}
\`\`\`

## Verifying Signatures

All webhook requests include a signature header:

\`\`\`
X-TyneBase-Signature: sha256=abc123...
\`\`\`

Verify in your handler:

\`\`\`typescript
import crypto from 'crypto';

function verifyWebhook(
  payload: string, 
  signature: string, 
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expected)
  );
}
\`\`\`

## Retry Policy

Failed webhooks are retried with exponential backoff:

| Attempt | Delay |
|--------:|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failures, the webhook is disabled.

## Testing Webhooks

Use the webhook tester in Settings:

1. Select an event type
2. Click **Send Test**
3. View request/response in the log
`
  },
  {
    id: 'api-5',
    slug: 'local-development',
    title: 'Local Development Setup',
    description: 'Set up a local development environment to build integrations with the TyneBase API.',
    category: 'API Reference',
    readTime: '10 min',
    lastUpdated: '2026-01-10',
    tags: ['api', 'development', 'local', 'setup'],
    content: `
# Local Development Setup

Set up a local environment to develop and test TyneBase API integrations.

## Prerequisites

- Node.js 20+ or Python 3.11+
- Docker (optional, for local API mock)
- Git

## Quick start with SDK

### JavaScript/TypeScript

\`\`\`bash
# Create new project
mkdir my-tynebase-integration
cd my-tynebase-integration
npm init -y

# Install SDK
npm install @tynebase/sdk typescript ts-node
\`\`\`

Create \`index.ts\`:

\`\`\`typescript
import { TyneBase } from '@tynebase/sdk';

const client = new TyneBase({
  apiKey: process.env.TYNEBASE_API_KEY,
  baseUrl: 'https://api.tynebase.com/v1', // or local mock
});

async function main() {
  // List documents
  const docs = await client.documents.list({ limit: 10 });
  console.log('Documents:', docs.data);

  // Create a document
  const newDoc = await client.documents.create({
    title: 'Created via API',
    content: '# Hello World\\n\\nThis was created programmatically.',
    state: 'draft',
  });
  console.log('Created:', newDoc.data.id);

  // AI Search
  const answer = await client.ask('How do I get started?');
  console.log('Answer:', answer.data.answer);
}

main().catch(console.error);
\`\`\`

Run with:
\`\`\`bash
TYNEBASE_API_KEY=your_key npx ts-node index.ts
\`\`\`

### Python

\`\`\`bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\\Scripts\\activate on Windows

# Install SDK
pip install tynebase
\`\`\`

Create \`main.py\`:

\`\`\`python
import os
from tynebase import TyneBase

client = TyneBase(
    api_key=os.environ['TYNEBASE_API_KEY'],
    base_url='https://api.tynebase.com/v1'
)

# List documents
docs = client.documents.list(limit=10)
for doc in docs.data:
    print(f"- {doc.title}")

# Create document
new_doc = client.documents.create(
    title="Created via Python",
    content="# Hello\\n\\nCreated with Python SDK",
    state="draft"
)
print(f"Created: {new_doc.data.id}")

# AI Search
answer = client.ask("What is TyneBase?")
print(f"Answer: {answer.data.answer}")
\`\`\`

## Local API Mock Server

For offline development, run a local mock:

\`\`\`bash
# Clone mock server
git clone https://github.com/tynebase/api-mock
cd api-mock

# Install and run
npm install
npm start
\`\`\`

Mock server runs at \`http://localhost:3001\`.

Configure SDK:
\`\`\`typescript
const client = new TyneBase({
  apiKey: 'test-key',
  baseUrl: 'http://localhost:3001/v1',
});
\`\`\`

## Environment Variables

Create \`.env\` file:

\`\`\`bash
# API Configuration
TYNEBASE_API_KEY=your_api_key_here
TYNEBASE_BASE_URL=https://api.tynebase.com/v1

# For tenant-specific access
TYNEBASE_TENANT_ID=your_tenant_id

# Webhook development
TYNEBASE_WEBHOOK_SECRET=your_webhook_secret
\`\`\`

## Webhook Development

Use ngrok for local webhook testing:

\`\`\`bash
# Install ngrok
npm install -g ngrok

# Start local server
node webhook-server.js  # listening on port 3000

# Expose via ngrok
ngrok http 3000
\`\`\`

Register the ngrok URL as your webhook endpoint in TyneBase settings.

## Testing

### Unit Tests

\`\`\`typescript
import { TyneBase } from '@tynebase/sdk';
import { mockClient } from '@tynebase/sdk/testing';

describe('My Integration', () => {
  const client = mockClient();

  it('should list documents', async () => {
    client.documents.list.mockResolvedValue({
      data: [{ id: 'doc_1', title: 'Test' }],
    });

    const result = await client.documents.list();
    expect(result.data).toHaveLength(1);
  });
});
\`\`\`

### Integration Tests

\`\`\`typescript
// Use a test API key with limited permissions
const testClient = new TyneBase({
  apiKey: process.env.TYNEBASE_TEST_API_KEY,
});

describe('Integration Tests', () => {
  it('should create and delete document', async () => {
    const doc = await testClient.documents.create({
      title: 'Test Doc',
      content: 'Test content',
    });
    
    expect(doc.data.id).toBeDefined();
    
    await testClient.documents.delete(doc.data.id);
  });
});
\`\`\`

## Rate Limit Handling

The SDK automatically handles rate limits:

\`\`\`typescript
const client = new TyneBase({
  apiKey: 'your_key',
  retryOnRateLimit: true,
  maxRetries: 3,
});
\`\`\`
`
  }
];
