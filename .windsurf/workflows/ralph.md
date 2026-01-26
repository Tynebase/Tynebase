---
description: Run a RALPH development loop for autonomous AI-to-AI task execution
---

# RALPH Development Loop Workflow

This workflow executes the RALPH (Rapid Autonomous Loop for Programmatic Handling) protocol for TyneBase development.

## 🚨 CRITICAL EXECUTION RULES

**ONE TASK AT A TIME - NO EXCEPTIONS**

1. ✅ Execute **ONLY ONE TASK** per workflow invocation
2. 🛑 **STOP COMPLETELY** after completing each task
3. 📊 **REPORT RESULTS** to user with test evidence
4. ⏸️ **WAIT FOR USER APPROVAL** before starting next task
5. 🧪 **TEST THOROUGHLY** - never skip validation steps

**Why This Matters:**
- Ensures quality control at each step
- Allows user to review changes incrementally
- Prevents cascading errors across multiple tasks
- Enables proper testing and validation
- Maintains clear audit trail

**If you complete a task and start another without user approval, you are violating the protocol.**

---

## 🎯 Mode Selection

RALPH supports two execution modes. Choose based on your task:

### Mode A: Backend Development (Milestone 2)
- **PRD File**: `RALPH_milestone2_build_docs/PRD.json`
- **Task IDs**: `1.1`, `2.1`, `3.1`, etc.
- **Focus**: Database, API routes, workers, AI integrations

### Mode B: Frontend-Backend Integration (Milestone 2.5)
- **PRD File**: `RALPH_milestone2_build_docs/prd_integration.json`
- **Task IDs**: `I1.1`, `I2.1`, `I3.1`, etc.
- **Focus**: Wiring frontend UI to backend API, deployment, E2E testing

**To switch modes**, use the appropriate PRD file when checking status.

---

## Prerequisites

- **Working directory**: `RALPH_milestone2_build_docs/`
- **Backend PRD Files**: `PRD.md`, `PRD.json`, `ralph_state.json`
- **Integration PRD Files**: `prd_integration.md`, `prd_integration.json`, `tasklist_integration.md`
- **Supabase CLI**: Access via `npx supabase <command>` (no global install needed)
- **Real Credentials**: `backend/.env` contains actual Supabase credentials
- **Test Infrastructure**: `/tests` directory contains validation scripts

---

## 📂 Project Structure & Key Paths

### Backend (Fastify API on Fly.io)
```
backend/
├── src/
│   ├── server.ts              # Main entry point
│   ├── config/
│   │   └── env.ts             # Environment validation (Zod)
│   ├── lib/
│   │   └── supabase.ts        # Supabase client (USE THIS!)
│   ├── middleware/
│   │   ├── auth.ts            # JWT verification
│   │   ├── tenantContext.ts   # Tenant subdomain extraction
│   │   ├── membershipGuard.ts # Tenant membership check
│   │   ├── rateLimit.ts       # Rate limiting
│   │   └── creditGuard.ts     # AI credit check
│   ├── routes/
│   │   ├── auth.ts            # POST /api/auth/signup, login, GET /me
│   │   ├── documents.ts       # CRUD /api/documents
│   │   ├── templates.ts       # GET/POST /api/templates
│   │   ├── ai-*.ts            # AI endpoints (/api/ai/*)
│   │   ├── gdpr.ts            # GDPR endpoints
│   │   └── superadmin.ts      # Super admin endpoints
│   ├── services/
│   │   └── ai/                # AI provider integrations
│   ├── workers/               # Background job handlers
│   └── utils/                 # Helpers (tokenCounter, etc.)
├── .env                       # Real credentials (DO NOT COMMIT)
└── .env.example               # Template for env vars
```

### Frontend (Next.js on Vercel)
```
tynebase-frontend/
├── app/
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Landing page
│   ├── login/page.tsx         # Login page (wire to /api/auth/login)
│   ├── signup/page.tsx        # Signup page (wire to /api/auth/signup)
│   └── dashboard/
│       ├── page.tsx           # Dashboard home
│       ├── knowledge/         # Documents (wire to /api/documents)
│       ├── ai-assistant/      # AI features (wire to /api/ai/*)
│       ├── chat/              # RAG chat (wire to /api/ai/chat)
│       ├── templates/         # Templates (wire to /api/templates)
│       ├── sources/           # RAG index health
│       └── settings/          # User/tenant settings
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── layout/                # Layout components
│   └── editor/                # TipTap editor
├── lib/
│   ├── supabase/              # Supabase client setup
│   ├── api/                   # API service layer (CREATE THIS)
│   └── utils.ts               # Utility functions
├── contexts/
│   └── AuthContext.tsx        # Auth state management
├── types/
│   └── api.ts                 # API type definitions (CREATE THIS)
├── middleware.ts              # Route protection
└── .env.example               # Frontend env vars
```

### Database (Supabase PostgreSQL)
```
supabase/
└── migrations/                # SQL migration files
    ├── 001_identity.sql       # tenants, users tables
    ├── 002_documents.sql      # documents, templates tables
    ├── 003_embeddings.sql     # document_embeddings (pgvector)
    ├── 004_jobs.sql           # job_queue table
    ├── 005_lineage.sql        # document_lineage audit trail
    ├── 006_consents.sql       # user_consents table
    └── 007_credits.sql        # credit_pools, query_usage
```

---

## ⚠️ CRITICAL: Supabase Authentication (READ THIS FIRST)

**TyneBase uses the NEW Supabase API keys. Follow these rules strictly.**

### ✅ CORRECT - Backend: Import from lib/supabase
```typescript
// ALWAYS use the pre-configured client
import { supabaseAdmin } from '../lib/supabase';

// The client automatically uses:
// - SUPABASE_SECRET_KEY (new format: sb_secret_...)
// - Falls back to SUPABASE_SERVICE_ROLE_KEY (deprecated)
```

### ✅ CORRECT - Frontend: Use Publishable Key
```typescript
// In frontend lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! // NOT ANON_KEY
);
```

### ✅ CORRECT - Frontend API Client: Use Backend API
```typescript
// For most operations, call the backend API, NOT Supabase directly
// Create lib/api/client.ts:
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('access_token');
  const tenant = localStorage.getItem('tenant_subdomain');
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'x-tenant-subdomain': tenant || '',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API Error');
  }
  
  return response.json();
}
```

### ❌ NEVER DO THIS
```typescript
// ❌ Don't create new clients with old keys
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = createClient(url, process.env.SUPABASE_ANON_KEY);

// ❌ Don't call Supabase directly from frontend for protected data
const { data } = await supabase.from('documents').select('*'); // WRONG!

// ✅ Instead, call your backend API
const documents = await apiClient('/api/documents'); // CORRECT!
```

### Key Selection Logic (Automatic)
| Operation | Primary Key | Fallback Key |
|-----------|-------------|--------------|
| Backend Admin | `SUPABASE_SECRET_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
| Frontend Client | `SUPABASE_PUBLISHABLE_KEY` | `SUPABASE_ANON_KEY` |

### Why This Matters
- ✅ New keys can be rotated independently without downtime
- ✅ Better security and observability
- ✅ Browser detection prevents accidental secret key exposure
- ✅ Backend API provides proper tenant isolation via RLS
- 📖 Full details: `docs/Supabase_API_Key_Migration_COMPLETED.md`

---

## 🔌 Backend API Endpoints Reference

### Authentication
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/signup` | POST | No | Create tenant + admin user |
| `/api/auth/login` | POST | No | Get JWT tokens |
| `/api/auth/me` | GET | Yes | Current user + tenant info |

### Documents
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/documents` | GET | Yes | List with filters, pagination |
| `/api/documents` | POST | Yes | Create draft document |
| `/api/documents/:id` | GET | Yes | Get single document |
| `/api/documents/:id` | PATCH | Yes | Update content |
| `/api/documents/:id` | DELETE | Yes | Delete document |
| `/api/documents/:id/publish` | POST | Yes | Publish document |
| `/api/documents/import` | POST | Yes | Import PDF/DOCX |

### Templates
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/templates` | GET | Yes | List templates |
| `/api/templates` | POST | Admin | Create template |
| `/api/templates/:id/use` | POST | Yes | Create doc from template |

### AI Operations
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/ai/generate` | POST | Yes | Generate from prompt (async job) |
| `/api/ai/chat` | POST | Yes | RAG chat (streaming) |
| `/api/ai/enhance` | POST | Yes | Enhance document |
| `/api/ai/video/upload` | POST | Yes | Upload video for transcription |
| `/api/ai/video/youtube` | POST | Yes | Process YouTube URL |
| `/api/ai/scrape` | POST | Yes | Scrape URL content |
| `/api/rag/search` | POST | Yes | Search embeddings |
| `/api/jobs/:id` | GET | Yes | Get job status |

### Sources (RAG Index)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/sources/health` | GET | Yes | Index health stats |
| `/api/sources/:id/reindex` | POST | Yes | Trigger re-index |

### GDPR & Settings
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/gdpr/consents` | GET | Yes | Get consent preferences |
| `/api/gdpr/consents` | PATCH | Yes | Update consents |
| `/api/gdpr/export` | GET | Yes | Export user data |
| `/api/tenants/:id` | PATCH | Admin | Update tenant settings |

### Request Headers (Required for authenticated endpoints)
```
Authorization: Bearer <jwt_token>
x-tenant-subdomain: <tenant_subdomain>
Content-Type: application/json
```

---

## 🛠️ Integration Best Practices

### 1. API Service Layer Pattern
Create service files in `tynebase-frontend/lib/api/`:

```typescript
// lib/api/documents.ts
import { apiClient } from './client';
import type { Document, CreateDocumentRequest } from '@/types/api';

export const documentsApi = {
  list: (params?: { page?: number; status?: string }) => 
    apiClient<{ data: Document[]; total: number }>('/api/documents', { 
      method: 'GET',
      // Add query params
    }),
    
  get: (id: string) => 
    apiClient<Document>(`/api/documents/${id}`),
    
  create: (data: CreateDocumentRequest) => 
    apiClient<Document>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
  update: (id: string, data: Partial<Document>) =>
    apiClient<Document>(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    
  delete: (id: string) =>
    apiClient<void>(`/api/documents/${id}`, { method: 'DELETE' }),
};
```

### 2. Auth Flow
```typescript
// On login success:
const { access_token, refresh_token, user, tenant } = await response.json();
localStorage.setItem('access_token', access_token);
localStorage.setItem('refresh_token', refresh_token);
localStorage.setItem('tenant_subdomain', tenant.subdomain);

// On logout:
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
localStorage.removeItem('tenant_subdomain');
```

### 3. Error Handling
```typescript
// Global error handler in API client
if (response.status === 401) {
  // Token expired - redirect to login
  localStorage.clear();
  window.location.href = '/login';
}

if (response.status === 429) {
  // Rate limited - show user-friendly message
  throw new Error('Too many requests. Please wait and try again.');
}

if (response.status === 403 && error.code === 'INSUFFICIENT_CREDITS') {
  // Out of credits - prompt upgrade
  throw new Error('Insufficient credits. Please upgrade your plan.');
}
```

### 4. Real-Time Collaboration (Hocuspocus)
```typescript
// Connect TipTap to Hocuspocus WebSocket
import { HocuspocusProvider } from '@hocuspocus/provider';

const provider = new HocuspocusProvider({
  url: process.env.NEXT_PUBLIC_COLLAB_URL!, // wss://tynebase-collab.fly.dev
  name: `document-${documentId}`,
  token: localStorage.getItem('access_token'),
});
```

---

## Testing Infrastructure

**Location:** All test files are in `/tests` directory

**Available Test Scripts:**
- `insert_test_tenant.js` - Creates test tenant in database (Node.js)
- `validate_credits.js` - Validates credit tracking system
- `validate_pgvector.js` - Validates pgvector extension and embeddings
- `validate_embeddings.sql` - SQL validation for embeddings table
- `test_tenant_insert.sql` - SQL script for test tenant creation
- `test_validation_1_X.sql` - Database validation scripts for Phase 1 tasks

**Running Tests:**

All tests should be run from the **project root directory**:

```bash
# Node.js tests (require backend/.env with real credentials)
node tests/insert_test_tenant.js
node tests/validate_credits.js
node tests/validate_pgvector.js

# SQL tests (use Supabase dashboard SQL editor)
# Copy/paste content from tests/test_validation_1_X.sql files
```

**Important Notes:**
- ✅ `backend/.env` has real Supabase credentials (service role + anon key)
- ✅ Test tenant exists: subdomain `test`, ID `1521f0ae-4db7-4110-a993-c494535d9b00`
- ✅ All validation scripts can be run against remote database
- ✅ Use these scripts to verify database migrations and API functionality

---

## Supabase Commands Reference

All Supabase CLI commands use `npx supabase`:

| Command | Description |
|---------|-------------|
| `npx supabase status` | Check local Supabase status |
| `npx supabase projects list` | List all linked projects |
| `npx supabase db push` | Push migrations to remote database (PREFERRED) |
| `npx supabase db reset` | Reset LOCAL database and run all migrations |
| `npx supabase migration list` | List all migrations |

**For database tasks**: 
- Migrations are in `supabase/migrations/`
- **ALWAYS use `npx supabase db push` to test on remote database**
- Remote database is linked: **TyneBase DB** (fsybthuvikyetueizado)
- Local testing with `db reset` is optional, but remote push is REQUIRED for validation

---

## Step 1: Check Current Status

// turbo
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py status
```

Review the current state before proceeding.

---

## Step 2: Get Next Task

// turbo
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py next
```

Read the task details carefully.

---

## Step 3: Start the Task

Replace `TASK_ID` with the actual task ID (e.g., `1.1`):

```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py start TASK_ID
```

---

## Step 4: Consult PRD Documentation

Before implementing, read the relevant section based on your mode:

**Mode A (Backend - tasks 1.1, 2.1, etc.):**
- `RALPH_milestone2_build_docs/PRD.md` - Backend requirements
- `RALPH_milestone2_build_docs/RALPH.md` - Detailed task descriptions

**Mode B (Integration - tasks I1.1, I2.1, etc.):**
- `RALPH_milestone2_build_docs/prd_integration.md` - Integration requirements
- `RALPH_milestone2_build_docs/tasklist_integration.md` - Progress tracking
- `docs/API_DOCUMENTATION.md` - Full API reference
- `docs/RUNBOOK.md` - Operational procedures

Look for:
- **Action**: What to implement
- **Validation**: How to verify it works
- **Security**: Security considerations

**For Integration Tasks, also check:**
- `tynebase-frontend/DASHBOARD_UI_STATUS.md` - Which UI pages need wiring
- `backend/src/routes/*.ts` - Backend route implementations for reference

---

## Step 5: Implement the Feature

### Backend Coding Standards (Mode A):
- TypeScript strict mode
- Error handling with try-catch
- Input validation with Zod
- JSDoc comments
- Meaningful variable names
- RLS policies on all tables
- Never commit secrets
- Import `supabaseAdmin` from `../lib/supabase`

### Frontend Coding Standards (Mode B - Integration):
- TypeScript strict mode
- Use API service layer pattern (lib/api/*.ts)
- **NEVER call Supabase directly for protected data** - use backend API
- Store tokens in localStorage: `access_token`, `refresh_token`, `tenant_subdomain`
- Handle errors gracefully with user-friendly messages
- Add loading states for all async operations
- Use existing shadcn/ui components from `components/ui/`

### Key Frontend Files to Create/Modify:
```
tynebase-frontend/
├── lib/api/
│   ├── client.ts      # Base API client with auth headers
│   ├── auth.ts        # signup(), login(), getMe(), logout()
│   ├── documents.ts   # CRUD operations
│   ├── templates.ts   # Template operations
│   ├── ai.ts          # AI generation, chat, enhance
│   └── settings.ts    # GDPR, consents, tenant settings
├── types/
│   └── api.ts         # TypeScript interfaces for API responses
└── contexts/
    └── AuthContext.tsx # Update to use backend API
```

---

## Step 6: Push to Remote Database (For DB Tasks)

**For database migration tasks ONLY**, push to remote database:

// turbo
```bash
npx supabase db push
```

Verify the output shows successful migration application. This tests against the **actual production-linked database**.

---

## Step 7: Run Validation

Execute the validation steps specified in the task. Paste actual output, not "it worked".

### For Backend/Database Tasks (Mode A):

1. **Primary validation**: `npx supabase db push` succeeds without errors
2. **Schema verification**: Use schema dump to verify all components created:

```bash
npx supabase db dump --schema public --data-only=false | Select-String -Pattern "table_name|function_name" -Context 2,2
```

This confirms:
- ✅ Tables created with correct schema
- ✅ Indexes created
- ✅ RLS enabled and policies created
- ✅ Functions/triggers created
- ✅ Foreign key and check constraints

### For Integration Tasks (Mode B):

**🧪 MANDATORY TESTING CHECKLIST - Complete ALL before marking task as PASS**

#### Phase 1 (API Client Setup) - Tasks I1.1 to I1.7:
```bash
# 1. TypeScript compilation check
cd tynebase-frontend && npx tsc --noEmit

# 2. Build verification
npm run build

# 3. Lint check
npm run lint
```

**Required Checks:**
- ✅ No TypeScript errors
- ✅ No build errors
- ✅ No lint errors
- ✅ All API functions properly typed
- ✅ Error handling implemented
- ✅ Auth headers included in requests

#### Phase 2 (Authentication) - Tasks I2.1 to I2.5:
```bash
# 1. Build check
cd tynebase-frontend && npm run build

# 2. Start dev server
npm run dev
```

**Manual Browser Tests (REQUIRED):**
1. Navigate to http://localhost:3000/signup
2. Fill form and submit → verify network request to backend
3. Check browser console for errors
4. Verify localStorage has: `access_token`, `refresh_token`, `tenant_subdomain`
5. Navigate to http://localhost:3000/login
6. Login with test credentials → verify redirect to dashboard
7. Check Network tab → verify JWT in Authorization header
8. Refresh page → verify user stays logged in
9. Logout → verify localStorage cleared

**Screenshot Required:** Show successful login with network request

#### Phase 3+ (UI Integration) - Tasks I3.1+:
```bash
# 1. Build check
cd tynebase-frontend && npm run build

# 2. Start dev server
npm run dev

# 3. Backend must be running
# Verify: curl https://tynebase-backend.fly.dev/health
```

**Manual Browser Tests (REQUIRED):**
1. Login to application
2. Navigate to the page being integrated
3. Perform CRUD operation (create/read/update/delete)
4. Check Network tab → verify API calls to backend
5. Verify data persists after page refresh
6. Check browser console for errors
7. Test error states (invalid input, network error)

**Screenshot Required:** Show successful operation with network request

#### Phase 10 (E2E Validation) - Tasks I10.1+:
- Complete user journey in browser
- Record video or multiple screenshots
- Test on both Chrome and Firefox
- Verify mobile responsiveness

**Test Evidence Required:**
- Screenshots of each step
- Network tab showing API calls
- Console showing no errors
- Database showing persisted data

### Environment Variables for Integration Testing:
```env
# tynebase-frontend/.env.local
NEXT_PUBLIC_API_URL=https://tynebase-backend.fly.dev
NEXT_PUBLIC_COLLAB_URL=wss://tynebase-collab.fly.dev
NEXT_PUBLIC_SUPABASE_URL=https://fsybthuvikyetueizado.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

---

## Step 8: Create Execution Summary

Create file `RALPH_milestone2_build_docs/execution_summaries/execution_summary_taskX_X.md`:

```markdown
# Execution Summary - Task [X.X]: [Task Name]

**Status:** ✅ PASS / ❌ FAIL  
**Completed:** [timestamp]  
**Validation:** [PASS/FAIL]

## What Was Implemented
[Brief description]

## Files Created/Modified
- `path/to/file.ts` - [what changed]

## Validation Results
[paste actual output]

## Security Considerations
- [List measures applied]

## Notes for Supervisor
[Anything important]
```

---

## Step 9: Mark Task Complete

**⚠️ BEFORE MARKING COMPLETE - VERIFY ALL REQUIREMENTS:**

### Pre-Completion Checklist:
- [ ] All code implemented as per task action
- [ ] TypeScript compilation passes (no errors)
- [ ] Build succeeds without errors
- [ ] Lint passes without errors
- [ ] All tests executed and passed
- [ ] Execution summary created
- [ ] Security considerations documented
- [ ] No hardcoded secrets or credentials
- [ ] Error handling implemented
- [ ] Loading states added (for UI tasks)

### For Integration Tasks - Additional Checks:
- [ ] API service layer uses backend API (not direct Supabase)
- [ ] Auth tokens properly injected in headers
- [ ] Tenant subdomain header included
- [ ] Error responses handled gracefully
- [ ] User-friendly error messages displayed
- [ ] Manual browser test completed successfully
- [ ] Screenshot/evidence captured

**Only proceed if ALL checkboxes are checked.**

If validation PASSED:
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py pass TASK_ID
```

If validation FAILED (after 2 retries):
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py fail TASK_ID
```

---

## Step 10: Commit Changes

Stage and commit with proper message format:

**For Backend Tasks (Mode A):**
```bash
git add .
git commit -m "feat(task-X.X): [clear description under 50 chars]"
```

**For Integration Tasks (Mode B):**
```bash
git add .
git commit -m "feat(integration-IX.X): [clear description under 50 chars]"
```

Example integration commits:
- `feat(integration-I1.1): create API client with auth headers`
- `feat(integration-I2.1): wire login page to backend API`
- `feat(integration-I3.1): connect document list to backend`

Record the commit:
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py commit "feat(task-X.X): description"
```

---

## Step 11: Push to Staging Branch

```bash
git push origin ralph/milestone2-staging
```

---

## Step 12: Report to Supervisor

**🛑 MANDATORY STOP POINT - DO NOT PROCEED TO NEXT TASK**

After completing each task, you MUST:

1. **Stop execution completely**
2. **Report to user with:**
   - ✅ Task ID and title
   - ✅ Status (PASS/FAIL)
   - ✅ Summary of what was implemented
   - ✅ Files created/modified
   - ✅ Test results (paste actual output)
   - ✅ Any concerns or blockers

3. **Wait for user approval** before starting next task

**Example Report Format:**
```
✅ TASK COMPLETED: I1.4 - Create Documents API Service Layer

Files Created:
- tynebase-frontend/lib/api/documents.ts (185 lines)

What Was Implemented:
- listDocuments() with pagination and filters
- getDocument(), createDocument(), updateDocument()
- deleteDocument(), publishDocument()
- getNormalizedContent()

Test Results:
- TypeScript compilation: ✅ PASS
- No lint errors: ✅ PASS
- All functions properly typed: ✅ PASS

Ready for next task? Awaiting user confirmation.
```

---

## When to STOP

❌ **STOP immediately if:**
- Validation fails after 2 retry attempts
- Ambiguity in PRD requirements (mark task with [?])
- Missing external dependencies (API keys, credentials)
- Security concern you're unsure about
- Architectural decision needed

✅ **ALWAYS STOP after:**
- **EVERY SINGLE TASK** - Never auto-continue to next task
- Creating execution summary
- Committing changes
- Pushing to staging branch

---

## Quick Commands Reference

### RALPH Runner Commands
| Command | Description |
|---------|-------------|
| `python ralph_runner.py status` | Show current state |
| `python ralph_runner.py next` | Get next task details |
| `python ralph_runner.py start X.X` | Start a task (e.g., `1.1` or `I1.1`) |
| `python ralph_runner.py pass X.X` | Mark task passed |
| `python ralph_runner.py fail X.X` | Mark task blocked |
| `python ralph_runner.py summary` | Show progress by phase |
| `python ralph_runner.py commit "msg"` | Record a commit |

### Frontend Development Commands
| Command | Description |
|---------|-------------|
| `cd tynebase-frontend && npm run dev` | Start dev server (localhost:3000) |
| `cd tynebase-frontend && npm run build` | Build for production |
| `cd tynebase-frontend && npm run lint` | Run ESLint |

### Backend Development Commands
| Command | Description |
|---------|-------------|
| `cd backend && npm run dev` | Start backend dev server |
| `cd backend && npm run build` | Build TypeScript |

### Deployment Commands
| Command | Description |
|---------|-------------|
| `flyctl status -a tynebase-backend` | Check backend status |
| `flyctl logs -a tynebase-backend` | View backend logs |
| `flyctl status -a tynebase-collab` | Check collab server status |
| `vercel --prod` | Deploy frontend to Vercel |

---

## 📚 Key Documentation Files

| File | Purpose |
|------|---------|
| `docs/API_DOCUMENTATION.md` | Complete API endpoint reference |
| `docs/RUNBOOK.md` | Operational procedures & troubleshooting |
| `docs/Supabase_API_Key_Migration_COMPLETED.md` | Supabase auth migration details |
| `tynebase-frontend/DASHBOARD_UI_STATUS.md` | Frontend pages needing integration |
| `backend/.env.example` | Backend environment variables |
| `tynebase-frontend/.env.example` | Frontend environment variables |

---

## 🚀 Getting Started with Integration Mode

To start the integration milestone:

1. **Check integration PRD**: Read `prd_integration.md` for full requirements
2. **Review task list**: Check `tasklist_integration.md` for all 56 tasks
3. **Start first task**: `python ralph_runner.py start I1.1`
4. **Create API client**: First task is setting up `lib/api/client.ts`
5. **Follow the phases**: Work through I1.x → I2.x → I3.x sequentially

**Important**: Integration tasks (I1.1, I2.1, etc.) focus on the **frontend**. 
Backend APIs are already built - you're wiring the UI to use them.

---

