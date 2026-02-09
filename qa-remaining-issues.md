# QA Remaining Issues — Manual Testing & Backend Fixes

> **Purpose:** This file contains all items from the QA review that could not be fixed programmatically in the previous session. Each item includes context, file locations, and suggested investigation steps so we can tackle them together in a fresh session.

---

## 1. Category Reorder — "Failed to save new order" error ✅ FIXED
**Screen:** Knowledge Base → Category filter pills  
**URL:** `/dashboard/knowledge`  
**Symptom:** Dragging/reordering category pills triggers a "Failed to save new order" error toast.  
**Root cause:** The frontend passed the "all" pseudo-category (non-UUID ID) to SortableCategories, causing "Invalid category ID format" error when calling updateCategory. Also: backend was missing sort_order in response, and permission check was too strict (required author for reorder).  
**Fixes applied:**
- `tynebase-frontend/app/dashboard/knowledge/page.tsx` — Render "All" button separately, only pass real API categories to SortableCategories
- `backend/src/routes/categories.ts` — Add sort_order to enriched response; relax permission check to allow any tenant member to reorder (sort_order-only updates)
- `tynebase-frontend/app/dashboard/knowledge/categories/page.tsx` — Fixed column alignment with CSS grid layout + table header
**Status:** ✅ Completed and tested — drag-drop and arrow buttons now work correctly

---

## 2. "Query Workspace" 404 ✅ FIXED
**Screen:** Knowledge Base header / Sources page  
**URL:** `/dashboard/knowledge` and `/dashboard/sources`  
**Symptom:** Clicking "Query Workspace" button on `/dashboard/knowledge` navigated to `/dashboard/sources/query` which returned 404. The same button on `/dashboard/sources` correctly went to `/dashboard/ai-assistant/ask`.

**Root cause:** The href on `/dashboard/knowledge` was incorrectly set to `/dashboard/sources/query` instead of `/dashboard/ai-assistant/ask`.

**Fix applied:**
- `tynebase-frontend/app/dashboard/knowledge/page.tsx:626` — Changed href from `/dashboard/sources/query` to `/dashboard/ai-assistant/ask`

**Status:** ✅ Completed

---

## 3. AI Enhancement — Execution Errors & Artifacts ✅ FIXED
**Screen:** Document Editor → AI Enhance panel  
**URL:** `/dashboard/knowledge/[ID]`  
**Symptom:** AI suggestions apply incorrectly — random letters inserted, spaces removed, double-apply on revert, content garbled. Also, no indication of where changes occur in the document.

**Root causes:**
1. AI generated `find` strings based on `document.content` (Markdown from DB) but editor works with plain text (`doc.textContent`) — mismatch caused replacements to fail
2. Revert used `undo()` which is unreliable in Y.js collaborative context, causing double-apply bugs
3. No visual indicator showing which line each suggestion targets

**Fixes applied:**
- `backend/src/routes/ai-enhance.ts` — Added optional `editor_content` field to request schema; when provided, AI analyzes editor plain text instead of DB Markdown. Updated AI prompt to emphasize verbatim matching.
- `tynebase-frontend/lib/api/ai.ts` — Added `editor_content` to `EnhanceRequest` interface
- `tynebase-frontend/components/editor/EnhanceSuggestionsPanel.tsx` — 
  - Sends `editor.getText()` to backend so find strings match editor content
  - Replaced `undo()`-based revert with proper reverse find-and-replace (avoids Y.js issues)
  - Added line number indicator badge with MapPin icon to each suggestion card
  - Added `scrollToSuggestion()` function that scrolls editor to the change location

**Status:** ✅ Completed

---

## 4. Text Rendering Vertical Splits ✅ FIXED
**Screen:** Document Editor  
**URL:** `/dashboard/knowledge/[ID]`  
**Symptom:** Some text renders with one letter per line (vertical splitting), seen in "Inspiration" and "Usage" sections.  

**Root cause:** Non-standard `word-break: break-word` on `.ProseMirror` caused vertical splitting. Additionally, the editor flex child lacked `min-width: 0`, allowing it to collapse when the AI panel was open.

**Fixes applied:**
- `editor-styles.css` — Changed `word-break: break-word` to `word-break: normal`, added `overflow-wrap: break-word` and `min-width: 0` on `.ProseMirror`
- `RichTextEditor.tsx` — Added `min-w-0` to the editor content flex child

**Status:** ✅ Completed

---

## 5. AI Panel Scroll Issue ✅ FIXED
**Screen:** Document Editor → AI Enhance panel  
**URL:** `/dashboard/knowledge/[ID]`  
**Symptom:** The AI suggestions panel scrolls with the whole page instead of independently. User can't read the article while reviewing AI suggestions.  

**Root cause:** Flex containers lacked `min-height: 0`, so flex items defaulted to `min-height: auto` which prevented `overflow-y: auto` from creating independent scroll regions.

**Fixes applied:**
- `RichTextEditor.tsx` — Added `min-h-0` to the editor+panel flex container
- `EnhanceSuggestionsPanel.tsx` — Added `min-h-0` and `overflow-hidden` to the panel wrapper

**Status:** ✅ Completed

---

## 6. Category Delete Server Error ✅ FIXED
**Screen:** Category Management → Delete modal  
**URL:** `/dashboard/knowledge/categories`  
**Symptom:** Clicking delete (after choosing migration target) returns a server error — "Category not found"

**Root causes:**
1. Frontend `deleteCategory()` sent literal string `"null"` as `migrate_to_category_id` query param when selecting Uncategorised, which failed Zod UUID validation on the backend
2. Backend DELETE endpoint restricted category deletion to the original author only — other tenant members got a 403
3. `is_system` field was missing from the categories list API response, so frontend couldn't properly guard system category delete buttons

**Fixes applied:**
- `lib/api/folders.ts` — Only include `migrate_to_category_id` query param when it's an actual UUID string (not null)
- `backend/src/routes/categories.ts` — Removed author-only restriction on delete (any tenant member can delete); added `is_system` to SELECT query and enriched response

**Status:** ✅ Completed

---

## 7. Indexing Status Reverting to "Outdated" ✅ FIXED
**Screen:** Sources / Indexing  
**URL:** `/dashboard/sources`  
**Symptom:** After successfully indexing a document, the status immediately reverts to "Outdated".  

**Root cause:** The DB trigger `update_updated_at_column()` sets `NEW.updated_at = NOW()` on every UPDATE to the documents table. When the worker/ingestion service set `last_indexed_at`, the trigger also bumped `updated_at` to a slightly later timestamp, causing `updated_at > last_indexed_at` — which immediately marked the document as "outdated". The previous 2-second buffer was too tight.

**Fixes applied:**
- `backend/src/services/rag/ingestion.ts` — Changed to set `last_indexed_at`, then read back the trigger-set `updated_at` and sync `last_indexed_at` to match it exactly
- `backend/src/workers/ragIndex.ts` — Same two-step sync fix for the worker path
- `backend/src/routes/rag.ts` — Increased outdated detection buffer from 2s to 30s in both `/api/sources/health` and `/api/sources` endpoints (real content edits have much larger gaps)

**Status:** ✅ Completed

---

## 8. Unresponsive Buttons on Sources Page ✅ FIXED
**Screen:** Sources / Indexing  
**URL:** `/dashboard/sources`  
**Buttons affected:**
- "Re-run health checks" — no onClick handler or handler does nothing
- "Retry failed normalizations" — no onClick handler
- "Review normalized Markdown" — no onClick handler

**Root cause:** The buttons didn't exist on the page. Backend endpoints already existed (`GET /api/sources/health`, `POST /api/sources/repair/stuck-jobs`, `GET /api/sources/normalized`) but the frontend had no UI to invoke them.

**Fixes applied:**
- `tynebase-frontend/app/dashboard/sources/page.tsx` — Added three action buttons in an action bar:
  - **Re-run Health Checks** — calls `fetchHealthData()` to refresh health statistics with loading spinner
  - **Retry Failed Normalizations** — calls `POST /api/sources/repair/stuck-jobs` to reset stuck jobs for retry, shows result summary
  - **Review Normalized Markdown** — calls `GET /api/sources/normalized` and opens a full-size modal with expandable accordion for each document's normalized markdown content
- Added `Modal` component import and state management for the normalized markdown review modal
- Added `apiPost` import for the retry endpoint call

**Status:** ✅ Completed

---

## 9. Video & Audio Ingest Errors ✅ FIXED (YouTube pipeline confirmed working)
**Screen:** Document Editor → Video node → "Add to RAG" button  
**URL:** `/dashboard/knowledge/[ID]`  
**Symptoms:**
- **Video:** Clicking "Start Transcription" on embedded YouTube video → job dispatched but fails immediately, UI shows "Processing Video" overlay forever with no error feedback
- **Audio:** Uploading audio file → "Processing Error" (Whisper SageMaker exception) — Whisper pipeline still to be tested

**Root causes found & fixed:**
1. **`YT_DLP_SIDECAR_URL` not set in Fly.io secrets** — Set to `http://tynebase-sidecar.internal:5000`
2. **Frontend swallowed job failure silently** — Fixed in `VideoNodeView.tsx` to handle `failed` status, reset UI, show error
3. **Frontend read wrong response path** — Fixed to use `data.job.status`
4. **`claim_job` SQL ignored `next_retry_at`** — Fixed with migration `20260209000000_fix_claim_job_retry_delay.sql`
5. **`worker.ts` `validateJobPayload` left jobs stuck** — Now calls `failJob()` on validation failure
6. **Sidecar gunicorn bound to IPv4 only** — Fly `.internal` DNS resolves to IPv6; fixed gunicorn bind to `[::]:5000`
7. **yt-dlp "Sign in to confirm you're not a bot"** — YouTube blocks Fly.io datacenter IPs. Fixed by adding DataImpulse residential proxy (`PROXY_URL` secret on sidecar)
8. **yt-dlp missing JS runtime** — Installed Node.js in sidecar Dockerfile, configured `js_runtimes: {'node': {}}`
9. **PO-token provider not running** — Installed `bgutil-ytdlp-pot-provider`, built its Node.js HTTP server, started it on port 4416 in `start.sh`
10. **Sidecar machines suspending (ENOTFOUND)** — Set `auto_stop_machines = 'off'`, destroyed extra machine, kept 1 always-on
11. **No retry logic for sidecar connection** — Added 5-retry backoff in `downloadYouTubeAudio` for `ENOTFOUND`/`ECONNREFUSED`

**Fixes applied across:**
- `tynebase-frontend/components/editor/extensions/VideoNodeView.tsx` — Job polling, error handling, UI reset
- `supabase/migrations/20260209000000_fix_claim_job_retry_delay.sql` — Retry delay enforcement
- `backend/src/worker.ts` — `failJob()` on validation failure
- `backend/src/workers/videoTranscribeToDocument.ts` — Sidecar retry logic with backoff
- `yt-dlp-sidecar/app.py` — Proxy support, PO-token extractor_args, js_runtimes config
- `yt-dlp-sidecar/Dockerfile` — Node.js, git, bgutil-ytdlp-pot-provider build
- `yt-dlp-sidecar/start.sh` — PO-token server startup, IPv6 gunicorn bind
- `fly.pot.toml` — `auto_stop_machines = 'off'`, `min_machines_running = 1`

**Remaining:**
- Whisper pipeline (non-Gemini models) — to be tested next session
- Frontend VideoNodeView fix + claim_job migration — not yet deployed to production frontend/DB

**Status:** ✅ YouTube transcription + Gemini summary pipeline fully working end-to-end

---

## 10. Permission Stats Inaccuracy ✅ FIXED
**Screen:** User Settings & Permissions  
**URL:** `/dashboard/settings/users`  
**Symptom:** The user counts shown on the Role Permission cards don't match actual user counts per role.  

**Root cause:** Role permission cards only showed role name and description — no user count was computed or displayed.

**Fix applied:**
- `tynebase-frontend/app/dashboard/settings/users/page.tsx` — Added `roleUserCount` computation per role card that filters the loaded `users` array by role (with `member` → `contributor` mapping). Displayed as a colored badge (e.g., "3 users") on each role card.

**Status:** ✅ Completed

---

## 11. Custom Role CRUD & Edit Permissions — N/A (Design Limitation)
**Screen:** User Settings & Permissions  
**URL:** `/dashboard/settings/users`  
**Symptoms:**
- Admins cannot delete custom roles
- Admins cannot edit permissions for existing roles
- System roles should NOT be deletable

**Investigation result:** Roles are hardcoded system roles (`admin`, `editor`, `contributor`, `viewer`) in the frontend — there is no `roles` or `custom_roles` table in the DB, and no backend CRUD endpoints for role management. Custom roles are not a feature of the current system.

**Status:** N/A — No custom roles exist. System roles are correctly non-deletable. User counts per role are now shown (see #10). Full custom role CRUD would be a new feature, not a bug fix.

---

## 12. Misc — Activity Screen Issues ✅ FIXED
**Screen:** Knowledge Base Activity  
**URL:** `/dashboard/knowledge/activity`  
**Symptoms:**
- "Community" button appears here (shouldn't it?)
- "New Document" button redirects to a 404 page
- When in AI enhance, see all activity redirects to community instead of redirecting to the correct `/dashboard/knowledge/activity`

**Root causes:**
1. "Community" button linked to `/dashboard/community` — misplaced on the activity page
2. "New Document" button linked to `/dashboard/knowledge/documents/new` which doesn't exist (correct path is `/dashboard/knowledge/new`)
3. No "activity" or "community" links found in the AI enhance panel — this sub-issue was likely referring to the activity page itself

**Fixes applied:**
- `tynebase-frontend/app/dashboard/knowledge/activity/page.tsx` — Changed "Community" button to "Knowledge Base" linking to `/dashboard/knowledge` (more contextually appropriate navigation). Fixed "New Document" href from `/dashboard/knowledge/documents/new` to `/dashboard/knowledge/new`.

**Status:** ✅ Completed

---

## 13. Collections & Tags — Delete Confirmation ✅ ALREADY FIXED
**Screen:** Settings → Collections / Tags  
**Symptom:** Deleting a Collection or Tag has no confirmation modal — it deletes immediately.  

**Investigation result:** Both pages already have delete confirmation modals implemented:
- `tynebase-frontend/app/dashboard/knowledge/collections/page.tsx` (lines 466-509) — Full delete confirmation modal with cancel/confirm buttons
- `tynebase-frontend/app/dashboard/knowledge/tags/page.tsx` (lines 804-864) — Full delete confirmation modal with warning about assigned documents

**Status:** ✅ Already implemented — no changes needed

---

## 14. Recent AI Generations — History, Tags, Navigation ✅ FIXED
**Screen:** AI Assistant  
**URL:** `/dashboard/ai-assistant`  
**Symptoms:**
- Not showing all generation history
- Tags not capitalized
- Clicking a generated article card doesn't navigate to the article

**Root causes:**
1. `listRecentGenerations({ limit: 5 })` only fetched 5 items — too few to show meaningful history
2. `gen.type` was displayed raw without `capitalize()` (e.g., "From Prompt" was already capitalized from backend, but consistency was missing)
3. Cards without a `document_id` (failed/pending jobs) still showed `cursor-pointer` but had no navigation, confusing users

**Fixes applied:**
- `tynebase-frontend/app/dashboard/ai-assistant/page.tsx` — Increased limit from 5 to 20. Applied `capitalize()` to `gen.type` for consistency. Made cards without `document_id` visually distinct (no cursor-pointer, reduced opacity) while keeping navigable cards interactive.

**Status:** ✅ Completed

---

## Quick Reference — Key File Paths

| Area | Frontend File | Backend Route |
|------|--------------|---------------|
| Knowledge Base | `app/dashboard/knowledge/page.tsx` | `routes/documents.ts` |
| Document Editor | `app/dashboard/knowledge/[id]/page.tsx` | `routes/documents.ts` |
| AI Enhance Panel | `components/editor/EnhanceSuggestionsPanel.tsx` | `routes/ai.ts` |
| Rich Text Editor | `components/editor/RichTextEditor.tsx` | — |
| Categories | `app/dashboard/knowledge/categories/page.tsx` | `routes/folders.ts` |
| Sources | `app/dashboard/sources/page.tsx` | `routes/sources.ts` |
| AI Chat | `app/dashboard/ai-chat/page.tsx` | `routes/ai.ts` |
| Notifications | `app/dashboard/notifications/page.tsx` | `routes/notifications.ts` |
| User Settings | `app/dashboard/settings/users/page.tsx` | `routes/users.ts` |
| API helpers | `lib/api/folders.ts`, `lib/api/documents.ts`, `lib/api/ai.ts` | — |
