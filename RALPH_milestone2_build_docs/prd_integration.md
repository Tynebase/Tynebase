# 🔗 TyneBase Frontend-Backend Integration PRD v1.0

**Milestone 2.5 – Connect Frontend to Backend API**

---

## Purpose of This Document

This PRD defines the integration milestone for TyneBase: connecting the Next.js frontend to the Fastify backend API, wiring all UI components to real data, and validating end-to-end functionality.

**Prerequisites:**
- Milestone 2 backend complete (all API endpoints operational)
- Frontend UI components built (mock data currently)
- Supabase database schema deployed
- Fly.io backend and collaboration servers running

---

## Scope

### ✅ In Scope for Integration Milestone

- **API Client Setup**: Create typed API service layer for frontend
- **Authentication Flow**: Wire login/signup to backend auth endpoints
- **Knowledge Centre**: Connect document CRUD to backend API
- **AI Assistant**: Wire AI generation, video ingestion, enhancement features
- **RAG Chat**: Connect chat interface to RAG API with streaming
- **Templates**: Wire template library to backend
- **Settings**: Connect user preferences and GDPR consent management
- **Real-Time Collaboration**: Connect TipTap editor to Hocuspocus server
- **Deployment**: Deploy frontend to Vercel, verify all integrations
- **E2E Testing**: Validate complete user flows work end-to-end

### ❌ Out of Scope

- New UI components (all UI already built)
- New backend endpoints (all APIs from Milestone 2)
- Community/discussion features (deferred to Milestone 3)
- Notification system (deferred to Milestone 3)
- Content audit features (deferred to Milestone 3)

---

## Backend API Endpoints Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create tenant and admin user |
| `/api/auth/login` | POST | Authenticate, return JWT |
| `/api/auth/me` | GET | Get current user profile |

### Documents
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List documents with filters |
| `/api/documents` | POST | Create new document |
| `/api/documents/:id` | GET | Get single document |
| `/api/documents/:id` | PATCH | Update document |
| `/api/documents/:id` | DELETE | Delete document |
| `/api/documents/:id/publish` | POST | Publish document |

### Templates
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/templates` | GET | List templates |
| `/api/templates` | POST | Create template |
| `/api/templates/:id/use` | POST | Create document from template |

### AI Operations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/generate` | POST | Generate content from prompt |
| `/api/ai/chat` | POST | RAG-enhanced chat (streaming) |
| `/api/ai/enhance` | POST | Enhance document content |
| `/api/ai/enhance/:id/apply` | POST | Apply enhancement suggestion |
| `/api/ai/video/upload` | POST | Upload video for transcription |
| `/api/ai/video/youtube` | POST | Process YouTube URL |
| `/api/ai/scrape` | POST | Scrape URL content |
| `/api/rag/search` | POST | Search document embeddings |

### Jobs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs/:id` | GET | Get job status |

### Sources (RAG Index)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sources/health` | GET | Get index health stats |
| `/api/sources/:id/reindex` | POST | Trigger manual re-index |

### GDPR & Settings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gdpr/consents` | GET | Get user consent preferences |
| `/api/gdpr/consents` | PATCH | Update consent preferences |
| `/api/gdpr/export` | GET | Export user data |
| `/api/tenants/:id` | PATCH | Update tenant settings |

---

## Phase 1: API Client Setup

**Dependencies:** None

### I1.1 [FE] Create Backend API Client Configuration
- **Action:** Create `lib/api/client.ts`
- **Implementation:**
  ```typescript
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  
  export async function apiClient<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('access_token');
    const tenant = localStorage.getItem('tenant_subdomain');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(tenant && { 'x-tenant-subdomain': tenant }),
      ...options.headers,
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.error.code, error.error.message, response.status);
    }
    
    return response.json();
  }
  ```
- **Validation:** Import client in test file, verify requests include headers

### I1.2 [FE] Create Type Definitions for API Responses
- **Action:** Create `types/api.ts`
- **Schema:**
  ```typescript
  interface User {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'editor' | 'member' | 'viewer';
    tenant_id: string;
    is_super_admin: boolean;
  }
  
  interface Tenant {
    id: string;
    subdomain: string;
    name: string;
    tier: string;
    settings: TenantSettings;
  }
  
  interface Document {
    id: string;
    tenant_id: string;
    title: string;
    content: string;
    status: 'draft' | 'published';
    author_id: string;
    created_at: string;
    updated_at: string;
  }
  
  interface Template {
    id: string;
    title: string;
    description: string;
    content: string;
    category: string;
    visibility: 'internal' | 'public';
  }
  
  interface Job {
    id: string;
    type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    created_at: string;
  }
  ```
- **Validation:** Types compile without errors, match API documentation

### I1.3 [FE] Create API Service Layer - Auth
- **Action:** Create `lib/api/auth.ts`
- **Functions:**
  - `signup(data: SignupRequest): Promise<AuthResponse>`
  - `login(email: string, password: string): Promise<AuthResponse>`
  - `getMe(): Promise<{user: User, tenant: Tenant}>`
  - `logout(): void`
- **Validation:** Each function makes correct API call

### I1.4 [FE] Create API Service Layer - Documents
- **Action:** Create `lib/api/documents.ts`
- **Functions:**
  - `listDocuments(params?: ListParams): Promise<PaginatedResponse<Document>>`
  - `getDocument(id: string): Promise<Document>`
  - `createDocument(data: CreateDocumentRequest): Promise<Document>`
  - `updateDocument(id: string, data: UpdateDocumentRequest): Promise<Document>`
  - `deleteDocument(id: string): Promise<void>`
  - `publishDocument(id: string): Promise<Document>`
- **Validation:** Each function makes correct API call

### I1.5 [FE] Create API Service Layer - Templates
- **Action:** Create `lib/api/templates.ts`
- **Functions:**
  - `listTemplates(params?: ListParams): Promise<PaginatedResponse<Template>>`
  - `createTemplate(data: CreateTemplateRequest): Promise<Template>`
  - `useTemplate(id: string): Promise<Document>`
- **Validation:** Each function makes correct API call

### I1.6 [FE] Create API Service Layer - AI Operations
- **Action:** Create `lib/api/ai.ts`
- **Functions:**
  - `generate(prompt: string, model?: string): Promise<{job_id: string}>`
  - `chat(query: string, options?: ChatOptions): Promise<ReadableStream | ChatResponse>`
  - `enhance(documentId: string): Promise<EnhanceResponse>`
  - `applyEnhancement(suggestionId: string): Promise<void>`
  - `uploadVideo(file: File): Promise<{job_id: string}>`
  - `processYouTube(url: string): Promise<{job_id: string}>`
  - `scrapeUrl(url: string): Promise<{markdown: string}>`
  - `getJobStatus(jobId: string): Promise<Job>`
- **Validation:** Each function makes correct API call

### I1.7 [FE] Create API Service Layer - GDPR & Settings
- **Action:** Create `lib/api/settings.ts`
- **Functions:**
  - `getConsents(): Promise<UserConsents>`
  - `updateConsents(data: ConsentUpdate): Promise<UserConsents>`
  - `updateTenant(id: string, data: TenantUpdate): Promise<Tenant>`
  - `exportData(): Promise<Blob>`
- **Validation:** Each function makes correct API call

---

## Phase 2: Authentication Integration

**Dependencies:** Phase 1

### I2.1 [FE] Wire Login Page to Backend API
- **Action:** Update `app/login/page.tsx`
- **Implementation:**
  1. Replace mock login with `auth.login(email, password)`
  2. Store `access_token` and `refresh_token` in localStorage
  3. Store `tenant_subdomain` in localStorage
  4. Redirect to `/dashboard` on success
  5. Display error message on failure
- **Validation:** Login with valid credentials redirects to dashboard

### I2.2 [FE] Wire Signup Page to Backend API
- **Action:** Update `app/signup/page.tsx`
- **Implementation:**
  1. Collect: email, password, tenant_name, subdomain, full_name
  2. Call `auth.signup(data)`
  3. Auto-login user after signup
  4. Redirect to dashboard
- **Validation:** Signup creates tenant, logs in user

### I2.3 [FE] Create Auth Context with Backend Session
- **Action:** Update `contexts/AuthContext.tsx`
- **Implementation:**
  1. On mount, check for stored token
  2. If token exists, call `auth.getMe()`
  3. Store user and tenant in context
  4. Provide `login`, `logout`, `isAuthenticated` functions
- **Validation:** Dashboard shows correct user info

### I2.4 [FE] Implement Protected Route Middleware
- **Action:** Update `middleware.ts`
- **Implementation:**
  1. Check for access_token in cookies/localStorage
  2. For `/dashboard/*` routes, redirect to `/login` if no token
  3. For `/login` and `/signup`, redirect to `/dashboard` if token exists
- **Validation:** Unauthenticated user cannot access dashboard

### I2.5 [FE] Add Token Refresh Logic
- **Action:** Update API client
- **Implementation:**
  1. Check token expiry before requests
  2. If expired, attempt refresh with refresh_token
  3. On 401 response, clear tokens and redirect to login
- **Validation:** Long sessions remain active, expired sessions redirect

---

## Phase 3: Knowledge Centre Integration

**Dependencies:** Phase 2

### I3.1 [FE] Wire Document List to Backend API
- **Action:** Update `app/dashboard/knowledge/page.tsx`
- **Implementation:**
  1. Replace mock data with `documents.listDocuments()`
  2. Implement pagination with page/limit params
  3. Add filter for status (draft/published)
  4. Add filter for parent_id (folders)
- **Validation:** Document list shows real documents from API

### I3.2 [FE] Wire Document View/Edit to Backend API
- **Action:** Update document detail/edit page
- **Implementation:**
  1. Fetch document with `documents.getDocument(id)`
  2. Populate editor with document content
  3. Save changes with `documents.updateDocument(id, data)`
  4. Auto-save on debounced content change (2s)
- **Validation:** Changes persist after page refresh

### I3.3 [FE] Wire Document Create Flow
- **Action:** Update create document UI
- **Implementation:**
  1. Show create dialog with title input
  2. Call `documents.createDocument({ title })`
  3. Redirect to `/dashboard/knowledge/[id]/edit`
- **Validation:** New document appears in list

### I3.4 [FE] Wire Document Delete Flow
- **Action:** Add delete functionality
- **Implementation:**
  1. Show confirmation dialog
  2. Call `documents.deleteDocument(id)`
  3. Remove from list, show success toast
- **Validation:** Document no longer appears after delete

### I3.5 [FE] Wire Document Publish Flow
- **Action:** Add publish button
- **Implementation:**
  1. Show in editor for draft documents
  2. Call `documents.publishDocument(id)`
  3. Update UI to show published status
- **Validation:** Document status changes to published

### I3.6 [FE] Integrate Real-Time Collaboration
- **Action:** Connect TipTap to Hocuspocus
- **Implementation:**
  1. Configure HocuspocusProvider with WebSocket URL
  2. Pass JWT token in connection params
  3. Sync Y.js document state
  4. Show collaborator cursors
- **Validation:** Two users can edit same document simultaneously

---

## Phase 4: AI Assistant Integration

**Dependencies:** Phase 2

### I4.1 [FE] Wire 'From Prompt' Generation
- **Action:** Update AI Assistant page
- **Implementation:**
  1. Add prompt input form
  2. Call `ai.generate(prompt, selectedModel)`
  3. Poll `ai.getJobStatus(jobId)` every 2s
  4. Display progress indicator
  5. On completion, show generated content, offer to save
- **Validation:** Prompt generates document content

### I4.2 [FE] Wire Video Upload & Processing
- **Action:** Add video upload UI
- **Implementation:**
  1. Add file drop zone for video files
  2. Call `ai.uploadVideo(file)`
  3. Poll job status
  4. Display transcript when complete
- **Validation:** Video file produces transcript

### I4.3 [FE] Wire YouTube URL Ingestion
- **Action:** Add YouTube input
- **Implementation:**
  1. Add URL input with validation
  2. Call `ai.processYouTube(url)`
  3. Poll job status
  4. Display transcript when complete
- **Validation:** YouTube URL produces transcript

### I4.4 [FE] Wire Document Enhancement
- **Action:** Add enhance feature
- **Implementation:**
  1. Add "Enhance" button in editor toolbar
  2. Call `ai.enhance(documentId)`
  3. Display suggestions with score
  4. Each suggestion has "Apply" button
  5. Apply calls `ai.applyEnhancement(suggestionId)`
- **Validation:** Enhancement suggestions appear, can be applied

### I4.5 [FE] Wire Document Import (PDF/DOCX)
- **Action:** Add import UI
- **Implementation:**
  1. Add file drop zone for PDF/DOCX/MD
  2. Call `documents.import(file)`
  3. Poll job status
  4. Navigate to created document
- **Validation:** PDF/DOCX converts to editable document

### I4.6 [FE] Wire URL Scraping
- **Action:** Add URL scrape UI
- **Implementation:**
  1. Add URL input
  2. Call `ai.scrapeUrl(url)`
  3. Display extracted markdown
  4. Add "Save as Document" button
- **Validation:** URL content extracts as markdown

### I4.7 [FE] Implement Job Status Polling UI
- **Action:** Create reusable component
- **Implementation:**
  1. `<JobStatusTracker jobId={id} onComplete={callback} />`
  2. Poll every 2 seconds
  3. Show progress bar / spinner
  4. Handle error state
- **Validation:** Component tracks job to completion

---

## Phase 5: RAG Chat Integration

**Dependencies:** Phase 3

### I5.1 [FE] Wire Chat Page to RAG API
- **Action:** Update `app/dashboard/chat/page.tsx`
- **Implementation:**
  1. Add message input
  2. Call `ai.chat(query, { stream: true })`
  3. Handle streaming response
  4. Display assistant messages as they arrive
- **Validation:** Chat responds with relevant context

### I5.2 [FE] Implement Chat History UI
- **Action:** Add conversation thread
- **Implementation:**
  1. Store messages in local state
  2. Display user/assistant message bubbles
  3. Scroll to bottom on new message
  4. Clear chat option
- **Validation:** Conversation persists during session

### I5.3 [FE] Display Source Citations
- **Action:** Show document references
- **Implementation:**
  1. Parse `sources` from chat response
  2. Display as clickable chips below response
  3. Link to source document
- **Validation:** Sources link to correct documents

### I5.4 [FE] Wire Sources Health Dashboard
- **Action:** Update `app/dashboard/sources/page.tsx`
- **Implementation:**
  1. Call `GET /api/sources/health`
  2. Display: total docs, indexed, outdated, failed
  3. List documents needing re-index
- **Validation:** Health stats match database state

### I5.5 [FE] Wire Manual Re-Index Trigger
- **Action:** Add re-index button
- **Implementation:**
  1. Button for each outdated document
  2. Call `POST /api/sources/:id/reindex`
  3. Track job status
  4. Update status when complete
- **Validation:** Re-index updates document embeddings

---

## Phase 6: Templates Integration

**Dependencies:** Phase 2

### I6.1 [FE] Wire Template List to Backend API
- **Action:** Update `app/dashboard/templates/page.tsx`
- **Implementation:**
  1. Call `templates.listTemplates()`
  2. Display template cards
  3. Add category filter
  4. Add search
- **Validation:** Templates load from API

### I6.2 [FE] Wire Template Create Flow
- **Action:** Add create template UI (admin only)
- **Implementation:**
  1. Show create form for admins
  2. Call `templates.createTemplate(data)`
  3. Redirect to template list
- **Validation:** New template appears in list

### I6.3 [FE] Wire 'Use Template' Flow
- **Action:** Add use button
- **Implementation:**
  1. Click "Use This Template"
  2. Call `templates.useTemplate(id)`
  3. Redirect to new document editor
- **Validation:** Template creates pre-filled document

---

## Phase 7: Settings Integration

**Dependencies:** Phase 2

### I7.1 [FE] Wire Profile Settings
- **Action:** Update profile settings page
- **Implementation:**
  1. Load user from auth context
  2. Edit form for full_name, email
  3. Save changes to API
- **Validation:** Profile changes persist

### I7.2 [FE] Wire Tenant Branding Settings
- **Action:** Update branding page (admin only)
- **Implementation:**
  1. Load tenant settings from context
  2. Edit logo_url, primary_color, secondary_color
  3. Call `settings.updateTenant(id, { settings: { branding } })`
- **Validation:** Branding changes reflect in UI

### I7.3 [FE] Wire GDPR Consent Management
- **Action:** Update privacy settings
- **Implementation:**
  1. Load with `settings.getConsents()`
  2. Toggle switches for ai_processing, analytics_tracking, knowledge_indexing
  3. Save with `settings.updateConsents(data)`
- **Validation:** Consent changes affect feature access

### I7.4 [FE] Wire Data Export
- **Action:** Add export button
- **Implementation:**
  1. Call `settings.exportData()`
  2. Trigger browser download of JSON file
- **Validation:** Download contains user data

---

## Phase 8: Environment Configuration

**Dependencies:** Phase 1-7

### I8.1 [FE] Configure Production Environment Variables
- **Action:** Update `.env.production`
- **Variables:**
  ```
  NEXT_PUBLIC_API_URL=https://tynebase-backend.fly.dev
  NEXT_PUBLIC_COLLAB_URL=wss://tynebase-collab.fly.dev
  NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=[key]
  ```
- **Validation:** Variables available in production build

### I8.2 [FE] Configure Vercel Deployment
- **Action:** Update `vercel.json` and Vercel dashboard
- **Implementation:**
  1. Set environment variables in Vercel dashboard
  2. Configure build settings
  3. Set up custom domain if applicable
- **Validation:** Vercel build succeeds

### I8.3 [BE] Verify Backend CORS Configuration
- **Action:** Update backend CORS
- **Implementation:**
  1. Add frontend domain to allowed origins
  2. Ensure credentials mode supported
- **Validation:** Frontend can make authenticated requests

### I8.4 [BE] Verify Fly.io Environment Variables
- **Action:** Verify secrets in Fly.io
- **Check:**
  - SUPABASE_URL
  - SUPABASE_SECRET_KEY
  - OPENAI_API_KEY
  - GCP_SERVICE_ACCOUNT_JSON
  - AWS credentials
- **Validation:** `flyctl secrets list` shows all required

---

## Phase 9: Deployment & Testing

**Dependencies:** Phase 8

### I9.1 [Deploy] Deploy Frontend to Vercel
- **Action:** Run production deployment
- **Command:** `vercel deploy --prod`
- **Validation:** Site accessible at production URL

### I9.2 [Deploy] Verify Backend Health
- **Action:** Check backend API
- **Command:** `curl https://tynebase-backend.fly.dev/health`
- **Expected:** `{"status":"ok"}`
- **Validation:** Backend responds with healthy status

### I9.3 [Deploy] Verify Collaboration Server
- **Action:** Test WebSocket connection
- **Tool:** `wscat -c wss://tynebase-collab.fly.dev`
- **Validation:** Connection established

---

## Phase 10: End-to-End Validation

**Dependencies:** Phase 9

### I10.1 [E2E] Test Signup → Login → Dashboard Flow
- **Steps:**
  1. Navigate to /signup
  2. Create new account with tenant
  3. Verify redirected to dashboard
  4. Logout, login again
  5. Verify dashboard shows correct user
- **Validation:** Complete flow works

### I10.2 [E2E] Test Document CRUD Flow
- **Steps:**
  1. Create new document
  2. Add content in editor
  3. Save document
  4. Refresh page, verify content persists
  5. Delete document
  6. Verify removed from list
- **Validation:** Document lifecycle works

### I10.3 [E2E] Test AI Generation Flow
- **Steps:**
  1. Navigate to AI Assistant
  2. Enter prompt
  3. Wait for generation
  4. Save as document
  5. Verify document in Knowledge Centre
- **Validation:** AI generates and saves content

### I10.4 [E2E] Test RAG Chat Flow
- **Steps:**
  1. Ensure documents are indexed
  2. Navigate to Chat
  3. Ask question about document content
  4. Verify response cites correct sources
- **Validation:** RAG provides relevant answers

### I10.5 [E2E] Test Real-Time Collaboration
- **Steps:**
  1. Open document in two browsers
  2. Type in browser A
  3. Verify changes appear in browser B
  4. Type in browser B
  5. Verify changes appear in browser A
- **Validation:** Changes sync in real-time

### I10.6 [E2E] Test Template Use Flow
- **Steps:**
  1. Navigate to Templates
  2. Click "Use Template"
  3. Verify new document created
  4. Verify content matches template
- **Validation:** Templates create pre-filled documents

### I10.7 [E2E] Test Settings & GDPR Flow
- **Steps:**
  1. Navigate to Settings
  2. Update consent preferences
  3. Export data
  4. Verify download contains user data
- **Validation:** GDPR features work

---

## Phase 11: Error Handling & Polish

**Dependencies:** Phase 10

### I11.1 [FE] Implement Global Error Boundary
- **Action:** Add error boundary component
- **Implementation:** Catch render errors, display fallback UI
- **Validation:** Errors don't crash entire app

### I11.2 [FE] Add Loading States
- **Action:** Add loading indicators
- **Implementation:** Skeleton loaders for lists, spinners for actions
- **Validation:** UI shows loading state during fetch

### I11.3 [FE] Add Toast Notifications
- **Action:** Implement toast system
- **Implementation:** Success/error toasts for CRUD operations
- **Validation:** User sees feedback on actions

### I11.4 [FE] Handle Rate Limit Errors
- **Action:** Handle 429 responses
- **Implementation:** Display message, show retry countdown
- **Validation:** User informed when rate limited

### I11.5 [FE] Handle Insufficient Credits
- **Action:** Handle credit errors
- **Implementation:** Display message, link to billing
- **Validation:** User informed when out of credits

---

## Success Criteria

Integration milestone is complete when:

1. ✅ All API service layers created and typed
2. ✅ Authentication flow works end-to-end
3. ✅ Document CRUD operations work
4. ✅ AI generation features work
5. ✅ RAG chat with citations works
6. ✅ Real-time collaboration works
7. ✅ Templates can be used
8. ✅ Settings and GDPR features work
9. ✅ Production deployment successful
10. ✅ All E2E tests pass

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-26  
**Milestone:** 2.5 - Frontend-Backend Integration
