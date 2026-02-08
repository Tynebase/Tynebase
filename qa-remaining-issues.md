# QA Remaining Issues — Manual Testing & Backend Fixes

> **Purpose:** This file contains all items from the QA review that could not be fixed programmatically in the previous session. Each item includes context, file locations, and suggested investigation steps so we can tackle them together in a fresh session.

---

## 1. Category Reorder — "Failed to save new order" error
**Screen:** Knowledge Base → Category filter pills  
**URL:** `/dashboard/knowledge`  
**Symptom:** Dragging/reordering category pills triggers a "Failed to save new order" error toast.  
**Root cause (likely):** The frontend calls a backend endpoint to persist the new order, and that endpoint is either missing or returning an error.  
**Files to investigate:**
- `tynebase-frontend/app/dashboard/knowledge/page.tsx` — look for the reorder handler / API call (search for `order` or `reorder` or `drag`)
- `backend/src/routes/` — look for a categories/folders reorder endpoint
- `tynebase-frontend/lib/api/folders.ts` — check if `reorderCategories` or similar function exists

**Steps:**
1. Reproduce by dragging category pills on the Knowledge Base page
2. Check browser Network tab for the failing request URL and response
3. Check Fly.io worker logs for the corresponding error
4. Fix the backend endpoint or create it if missing

---

## 2. "Query Workspace" 404
**Screen:** Knowledge Base header / Sources page  
**URL:** `/dashboard/knowledge` and `/dashboard/sources`  
**Symptom:** Clicking "Query Workspace" button navigates to `/dashboard/ai-assistant/ask` which returns 404.  
**Files to investigate:**
- `tynebase-frontend/app/dashboard/knowledge/page.tsx` — search for `Query Workspace` link
- `tynebase-frontend/app/dashboard/sources/page.tsx` — line ~230, same link
- `tynebase-frontend/app/dashboard/` — check if `ai-assistant/ask` route exists, or if it should be `/dashboard/ai-chat`

**Fix options:**
- Update the href to point to an existing route (e.g., `/dashboard/ai-chat`)
- Or create the missing `app/dashboard/ai-assistant/ask/page.tsx` route

---

## 3. AI Enhancement — Execution Errors & Artifacts
**Screen:** Document Editor → AI Enhance panel  
**URL:** `/dashboard/knowledge/[ID]`  
**Symptom:** AI suggestions apply incorrectly — random letters inserted, spaces removed, content garbled.  
**Files to investigate:**
- `tynebase-frontend/components/editor/EnhanceSuggestionsPanel.tsx` — the `handleAcceptSuggestion` / apply logic
- `backend/src/routes/ai.ts` — the `/api/ai/enhance` endpoint that generates suggestions
- The apply logic likely uses string replacement or editor commands that don't match the actual document positions

**Steps:**
1. Open a document, click "Enhance with AI"
2. Accept a suggestion and observe what changes in the editor
3. Check if the `from`/`to` positions in the suggestion match the actual content
4. Check backend logs for the AI response format

---

## 4. Text Rendering Vertical Splits
**Screen:** Document Editor  
**URL:** `/dashboard/knowledge/[ID]`  
**Symptom:** Some text renders with one letter per line (vertical splitting), seen in "Inspiration" and "Usage" sections.  
**Files to investigate:**
- `tynebase-frontend/components/editor/RichTextEditor.tsx` — CSS styles applied to the editor content
- Check if specific content has inline styles with `width: 0` or `word-break` issues
- Could be a TipTap extension conflict or CSS specificity issue

**Steps:**
1. Find/create a document that reproduces the vertical text
2. Inspect the DOM element in browser DevTools to see what CSS is causing it
3. Check for conflicting styles in the editor's `ProseMirror` container

---

## 5. AI Panel Scroll Issue
**Screen:** Document Editor → AI Enhance panel  
**URL:** `/dashboard/knowledge/[ID]`  
**Symptom:** The AI suggestions panel scrolls with the whole page instead of independently. User can't read the article while reviewing AI suggestions.  
**Files to investigate:**
- `tynebase-frontend/components/editor/RichTextEditor.tsx` — look for where `EnhanceSuggestionsPanel` is rendered (search for `showEnhance` or `EnhanceSuggestionsPanel`)
- The panel likely needs `position: sticky` or `overflow-y: auto` with a fixed height
- The parent flex container may need `overflow: hidden` so each child scrolls independently

**Suggested fix pattern:**
```css
/* Panel container */
.enhance-panel {
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
}
```

---

## 6. Category Delete Server Error
**Screen:** Category Management → Delete modal  
**URL:** `/dashboard/knowledge/categories`  
**Symptom:** Clicking delete (after choosing migration target) returns a server error.  
**Files to investigate:**
- `tynebase-frontend/app/dashboard/knowledge/categories/page.tsx` — `executeDelete` function (~line 318)
- `tynebase-frontend/lib/api/folders.ts` — `deleteCategory` function
- `backend/src/routes/folders.ts` or `backend/src/routes/categories.ts` — the DELETE endpoint
- Check if the migration logic (moving documents to target category) has a DB constraint issue

**Steps:**
1. Create a test category with a document in it
2. Try to delete it, choosing "Uncategorised" as target
3. Check Fly.io logs for the exact error
4. Common issues: foreign key constraints, missing RPC function, null handling

---

## 7. Indexing Status Reverting to "Outdated"
**Screen:** Sources / Indexing  
**URL:** `/dashboard/sources`  
**Symptom:** After successfully indexing a document, the status immediately reverts to "Outdated".  
**Files to investigate:**
- `tynebase-frontend/app/dashboard/sources/page.tsx` — `handleReindex` function and the polling/status check logic
- `backend/src/routes/` — the reindex endpoint and job status endpoint
- Check if the `last_indexed_at` timestamp is being updated in the DB after indexing completes
- The health check query may compare `updated_at > last_indexed_at` — if the document is touched during indexing, it'll immediately appear outdated

**Steps:**
1. Trigger a reindex on a document
2. Watch the Network tab for status polling responses
3. After "Complete!", check the DB record for `last_indexed_at` vs `updated_at`

---

## 8. Unresponsive Buttons on Sources Page
**Screen:** Sources / Indexing  
**URL:** `/dashboard/sources`  
**Buttons affected:**
- "Re-run health checks" — no onClick handler or handler does nothing
- "Retry failed normalizations" — no onClick handler
- "Review normalized Markdown" — no onClick handler

**Files to investigate:**
- `tynebase-frontend/app/dashboard/sources/page.tsx` — search for these button labels
- These likely need backend endpoints to be created:
  - `POST /api/sources/health-check` — re-run health analysis
  - `POST /api/sources/retry-normalization` — retry failed markdown conversions
  - A route/modal to view normalized markdown output

**Steps:**
1. Check if the buttons exist in the page (they may be in a section not yet scrolled to)
2. Wire onClick handlers to existing or new API endpoints
3. Create backend endpoints if missing

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
