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

## 9. Video & Audio Ingest Errors
**Screen:** AI Assistant / Ingest  
**URL:** `/dashboard/ai-assistant` or similar ingest flow  
**Symptoms:**
- **Video:** Pasting a YouTube URL → "Processing Error" (400 Bad Request / Vertex AI error)
- **Audio:** Uploading audio file → "Processing Error" (Whisper SageMaker exception)
- **Generate button:** Unresponsive after video URL input

**Files to investigate:**
- `backend/src/routes/ai.ts` or `backend/src/routes/ingest.ts` — video/audio processing endpoints
- Check Vertex AI configuration and API keys
- Check SageMaker Whisper endpoint configuration
- `tynebase-frontend/app/dashboard/ai-assistant/` — the ingest UI components

**Steps:**
1. Try pasting a YouTube URL and check Fly.io logs for the exact error
2. Try uploading a short audio file and check logs
3. Verify API keys and service endpoints are configured in environment variables

---

## 10. Permission Stats Inaccuracy
**Screen:** User Settings & Permissions  
**URL:** `/dashboard/settings/users`  
**Symptom:** The user counts shown on the Role Permission cards don't match actual user counts per role.  
**Files to investigate:**
- `tynebase-frontend/app/dashboard/settings/users/page.tsx` — the Role Permissions card section (~line 257-280)
- Currently the cards show role descriptions but no user counts — the counts may need to be computed from the `users` array
- Or there's a separate API endpoint returning incorrect stats

**Suggested fix:**
```tsx
// Add user count per role
const roleUserCount = (roleId: string) => users.filter(u => u.role === roleId).length;
// Display in the card: `${roleUserCount(role.id)} users`
```

---

## 11. Custom Role CRUD & Edit Permissions
**Screen:** User Settings & Permissions  
**URL:** `/dashboard/settings/users`  
**Symptoms:**
- Admins cannot delete custom roles
- Admins cannot edit permissions for existing roles
- System roles should NOT be deletable

**Files to investigate:**
- `tynebase-frontend/app/dashboard/settings/users/page.tsx` — role cards section
- `backend/src/routes/` — look for role management endpoints (CRUD for roles)
- DB schema: check if there's a `roles` or `custom_roles` table with `is_system` flag

**Steps:**
1. Check if custom role endpoints exist in the backend
2. Add delete button to custom role cards (with `is_system` guard)
3. Add edit permissions modal that updates role capabilities
4. Create backend endpoints if missing: `PUT /api/roles/:id`, `DELETE /api/roles/:id`

---

## 12. Misc — Activity Screen Issues
**Screen:** Knowledge Base Activity  
**URL:** `/dashboard/knowledge/activity`  
**Symptoms:**
- "Community" button appears here (shouldn't it?)
- "New Document" button redirects to a 404 page
- When in AI enhance, see all activity redirects to community instead of redirecting to the correct `/dashboard/knowledge/activity`

**Files to investigate:**
- `tynebase-frontend/app/dashboard/knowledge/activity/page.tsx` — check for the Community button and New Document link
- The New Document button likely links to a wrong path

**Steps:**
1. Navigate to the activity page
2. Check what the "New Document" button's href is — it should be `/dashboard/knowledge/new`
3. Determine if the "Community" button is intentional or misplaced

---

## 13. Collections & Tags — Delete Confirmation
**Screen:** Settings → Collections / Tags  
**Symptom:** Deleting a Collection or Tag has no confirmation modal — it deletes immediately.  
**Files to investigate:**
- Search for collection/tag management pages: `find_by_name` for `collections` or `tags` under `app/dashboard/`
- Add a confirmation modal (can reuse the existing `DeleteConfirmationModal` component from `components/ui/DeleteConfirmationModal.tsx`)

---

## 14. Recent AI Generations — History, Tags, Navigation
**Screen:** AI Assistant  
**URL:** `/dashboard/ai-chat` or `/dashboard/ai-assistant`  
**Symptoms:**
- Not showing all generation history
- Tags not capitalized
- Clicking a generated article card doesn't navigate to the article

**Files to investigate:**
- `tynebase-frontend/app/dashboard/ai-chat/page.tsx` — conversation list rendering
- Look for a "recent generations" or "history" section
- Check if article cards have proper `onClick` or `href` to `/dashboard/knowledge/[id]`
- Backend: check if the generations list API has proper pagination/limits

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
