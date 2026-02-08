# Feedback Fixes Progress

## Confirmed Bugs
- [x] B1: AI credits discrepancy — Dashboard now uses CreditsContext instead of independent fetch
- [x] B2: Enhance "Apply All" button — wired onClick to iterate and apply all unapplied suggestions
- [x] B3: Sidebar double-highlighting — added exact match for parent section routes
- [x] B4: Webhooks "Create" button — added full create modal with name, URL, event selection
- [x] B5: Permissions "Create Role" — client-only (no backend API exists, noted as limitation)
- [x] B6: AI Chat delete last conversation — working as intended (auto-creates on next send)
- [x] B7: Sidebar label "Normalized Markdown" → "Normalised Markdown"
- [x] B8: Enhance re-enhance — clear sessionStorage on new analysis to prevent stale data
- [x] I6: Template generate button — replaced fake setTimeout with actual handleGenerate() call

## UI Text Changes
- [x] T1: Video page description → "Automatically transform videos into comprehensive documentation"
- [x] T2: Audio page description → "Automatically transform audio recordings into comprehensive documentation"
- [x] T3: Removed breadcrumbs from: enhance, drafts, normalized, index health (video/audio had none)
- [x] T4: Help centre — already correct ("Find answers, guides and support")
- [x] T5: Permissions page — removed Oxford comma before "and attribute-based"
- [x] T7: Invite modal title → "Invite Users"

## Investigated & Fixed
- [x] I1: Filters — added functional status/reason/visibility filter dropdowns on imports, sources, normalized, collections
- [x] I2: New document button → 404 — route `/dashboard/knowledge/new` exists with full editor, not a code bug
- [x] I3: Source re-index "outdated" — added 2-second buffer to updated_at vs last_indexed_at comparison to account for DB trigger race condition
- [x] I4: AI Enhancement random letters — added server-side validation that `find` text exists in document content, drops invalid suggestions
- [x] I5: Scrape from URL error — fixed missing `{ success: true, data: {} }` response wrapper that frontend apiPost expects
