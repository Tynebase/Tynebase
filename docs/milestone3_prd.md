# TyneBase — Milestone 3 PRD
## Community, Team Chat & Multi-User Infrastructure

**Version**: 1.0 | **Status**: Ready for implementation

---

## 1. Current State Audit

> Read this before touching any file.

| Feature | Location | State |
|---|---|---|
| `/dashboard/users` | `app/dashboard/users/page.tsx` | UI exists. Invite works. **Bug**: catch block always shows success (line 258-263). Role-change is a toast stub. No pending invites. |
| Users CRUD | `app/dashboard/settings/users/page.tsx` | Duplicate page with actual updateUser/deleteUser. Must merge into `/dashboard/users` and remove duplicate. |
| Community forum | `app/dashboard/community/page.tsx` | **100% static mock data. No API calls.** |
| Community thread | `app/dashboard/community/[id]/page.tsx` | Hardcoded `[1,2,3].map` placeholder replies. Buttons non-functional. |
| New discussion | `app/dashboard/community/new/page.tsx` | Calls `createDiscussion` API but **no backend route exists**. Uses plain Textarea, not rich editor. |
| Sidebar | `components/layout/DashboardSidebar.tsx` | **Community is absent from sidebar.** Tools has Audit + Templates only. |
| Team Chat | `app/dashboard/chat/page.tsx` | This is AI RAG chat (localStorage). **No team chat feature exists.** |
| Discussions API | `lib/api/discussions.ts` | Functions defined. **No backend route registered in `server.ts`** — all 404. |
| Invite backend | `backend/src/routes/invites.ts` | Works. Admin-only. Sends Supabase magic link. |
| Accept invite page | — | **Does not exist.** |
| Pending invites | — | Not tracked or shown anywhere. |
| Collab server | `collab-server.ts`, `fly.collab.toml` | Yjs CRDT server deployed. Not wired to editor. |
| Community Shared Docs | — | Not implemented. `visibility` field exists in DB. |

---

## 2. Objective O1 — Users & Roles (`/dashboard/users`)

### What to fix

1. **Invite bug** — `catch` block (line 258-263 of `users/page.tsx`) shows success on failure. Fix to use proper error display.
2. **Role change stub** — `handleChangeRole` shows a toast pointing elsewhere. Replace with an inline modal that calls `updateUser(id, { role })`.
3. **Pending invites** — Add a "Pending Invitations" card below the members list showing invited-but-not-accepted users. Each row has Resend + Cancel actions.
4. **Delete user** — Add delete (soft) to the `···` dropdown, with confirmation modal calling `deleteUser`.
5. **Merge settings/users** — Move all functionality from `app/dashboard/settings/users/page.tsx` into `app/dashboard/users/page.tsx`. Delete the settings duplicate.
6. **Admin guard** — Non-admins visiting `/dashboard/users` see a permission-denied empty state (not crash/blank).

### New backend endpoints

```
GET    /api/invites/pending       — list outstanding invites (admin only)
DELETE /api/invites/:id           — cancel invite (admin only)
POST   /api/invites/:id/resend    — resend invite email (admin only)
```

Existing `PATCH /api/users/:id` already supports role/status — just wire it.

### Acceptance criteria

- [x] Admin invites a user → email sent → toast shows only on real success
- [x] Pending invites appear in their own section with Resend/Cancel
- [x] Role change works inline from users table (modal with role dropdown)
- [x] Delete user with confirmation works
- [x] Viewer/member/editor sees permission-denied state on `/dashboard/users`

---

## 3. Objective O2 — Team Chat (new feature)

A Slack-style persistent team chat. Lives at `/dashboard/tools/team-chat`.

### UI layout

```
┌─────────────────┬────────────────────────────────────────┐
│  CHANNELS       │  # general                             │
│  ───────────    │  ──────────────────────────────────    │
│  # general  ●   │  Sarah  2:34 PM                        │
│  # announcements│    Hello team!                         │
│  # random       │                                        │
│                 │  You  2:35 PM                          │
│  DIRECT         │    Sure, joining in 5.                 │
│  ───────────    │                                        │
│  John Smith     │  ────────────────────────────────────  │
│  Emily Davis    │  [Message #general...      ] [Send]    │
└─────────────────┴────────────────────────────────────────┘
```

### Features

- **Channels** — Default channels created per tenant: `#general`, `#announcements`, `#random`
- **Real-time** — Supabase Realtime `postgres_changes` subscriptions
- **Persistence** — Messages stored in DB (not localStorage)
- **Threads** — Click any message to open a thread sidebar
- **Reactions** — 👍 ❤️ 😂 basic emoji reactions
- **Unread indicators** — Bold channel name + count badge
- **History** — Last 100 messages on load
- **Markdown** — Bold, italic, inline code in messages

### Database migrations

```sql
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES chat_messages(id),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE chat_read_receipts (
  user_id UUID NOT NULL REFERENCES users(id),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);
```

RLS: All tables scoped to `tenant_id`. Members can read/write in channels of their tenant.

### Backend API routes (register in `server.ts`)

```
GET    /api/chat/channels                     list channels
POST   /api/chat/channels                     create channel (admin only)
GET    /api/chat/channels/:id/messages        get messages (paginated, last 100)
POST   /api/chat/channels/:id/messages        send message
PATCH  /api/chat/messages/:id                 edit message (own only)
DELETE /api/chat/messages/:id                 soft delete (own or admin)
POST   /api/chat/messages/:id/reactions       add reaction
DELETE /api/chat/messages/:id/reactions/:emoji remove reaction
PUT    /api/chat/channels/:id/read            mark channel as read
```

### Sidebar placement

In `DashboardSidebar.tsx`, add to `toolsNavigation`:

```typescript
{
  id: "team-chat",
  label: "Team Chat",
  icon: MessageSquare,
  href: "/dashboard/tools/team-chat",
  color: "#3b82f6",
}
```

Route: create `app/dashboard/tools/team-chat/page.tsx`

### Realtime pattern

```typescript
supabase.channel('team-chat')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public',
    table: 'chat_messages',
    filter: `channel_id=eq.${channelId}`
  }, (payload) => addMessage(payload.new))
  .subscribe()
```

---

## 4. Objective O3 — Community Forum (`/dashboard/community`)

### Sidebar placement

Community is **absent from the sidebar**. Add to `mainNavigation` in `DashboardSidebar.tsx`, directly below Dashboard:

```typescript
{
  id: "community",
  label: "Community",
  icon: Users,
  href: "/dashboard/community",
  color: "#8b5cf6",
}
```

### Database migrations

```sql
CREATE TABLE discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Announcements','Questions','Ideas','General')),
  author_id UUID NOT NULL REFERENCES users(id),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  replies_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  likes_count INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES discussion_replies(id),
  is_accepted_answer BOOLEAN DEFAULT FALSE,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE discussion_views (
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (discussion_id, user_id)
);

CREATE TABLE discussion_likes (
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (discussion_id, user_id)
);

CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  votes_count INT DEFAULT 0
);

CREATE TABLE poll_votes (
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  option_id UUID NOT NULL REFERENCES poll_options(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);
```

RLS: all tables scoped to `tenant_id`. All members can read + post. Admin/editor can pin, lock, delete.

### Backend API routes (register in `server.ts`)

```
GET    /api/discussions                          list (paginated, filter by category/sort)
POST   /api/discussions                          create
GET    /api/discussions/:id                      get single + increment views_count
PATCH  /api/discussions/:id                      edit (own or admin)
DELETE /api/discussions/:id                      delete (own or admin)
POST   /api/discussions/:id/like                 toggle like
POST   /api/discussions/:id/pin                  pin/unpin (admin/editor only)
POST   /api/discussions/:id/lock                 lock/unlock (admin/editor only)
POST   /api/discussions/:id/resolve              mark resolved
GET    /api/discussions/:id/replies              list replies (paginated)
POST   /api/discussions/:id/replies              post reply
PATCH  /api/discussions/:id/replies/:rid         edit reply (own or admin)
DELETE /api/discussions/:id/replies/:rid         delete reply (own or admin)
POST   /api/discussions/:id/replies/:rid/accept  mark accepted answer (thread author)
POST   /api/discussions/:id/poll/vote            vote on poll (already in discussions.ts)
POST   /api/discussions/:id/poll/remove-vote     remove poll vote
```

Views increment on GET:
```sql
INSERT INTO discussion_views (discussion_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;
UPDATE discussions SET views_count = views_count + 1 WHERE id = $1 AND NOT EXISTS (
  SELECT 1 FROM discussion_views WHERE discussion_id=$1 AND user_id=$2
);
```

### Frontend changes

**`app/dashboard/community/page.tsx`**
- Remove all hardcoded `discussions`, `trendingTopics`, `topContributors` arrays
- Call `listDiscussions(params)` on mount
- Add loading skeleton, error state, empty state: "No discussions yet. Be the first to start one!" with CTA
- Trending topics: derive from tag frequency in API response
- Top contributors: derive from actual post/reply counts from API
- Pagination calls real API with page params

**`app/dashboard/community/[id]/page.tsx`**
- Call `getDiscussion(id)` on mount
- Call `GET /api/discussions/:id/replies` for real replies
- Remove `[1,2,3].map` placeholder replies
- Reply form submits to `POST /api/discussions/:id/replies`
- Like button calls `POST /api/discussions/:id/like`
- Admin/editor `···` menu: Pin, Lock, Delete, Mark Resolved
- Redirect to `/dashboard/community` after delete

**`app/dashboard/community/new/page.tsx`**
- Replace `<Textarea>` for content with the existing TipTap document editor
- Add "Cite a Template" option: search/select a template and insert citation block
- On success: redirect to `/dashboard/community/[newId]` (not back to list)

### Acceptance criteria

- [ ] All discussions loaded from DB — zero hardcoded data
- [ ] Creating a discussion saves to DB and appears immediately
- [ ] Views counter increments on open (unique per user)
- [ ] Reply count updates when reply is posted
- [ ] Likes work (toggle, optimistic update)
- [ ] Polls work end-to-end (create, vote, results shown)
- [ ] Pin/lock/resolve work (admin/editor only)
- [ ] Empty states for no discussions and no replies
- [ ] Rich text editor for post content
- [ ] Template citation in new post works
- [ ] Pagination functional

---

## 5. Objective O4 — Community Shared Documents

A **separate section** from the forum, showing documents with `visibility = 'public'`.

### Location

Add as a sub-route: `/dashboard/community/shared-documents`

Add to the community page tab bar:
```
[Forum]   [Shared Documents]
```

### Data source

Documents where `visibility = 'public'` in the existing `documents` table.  
The `add_document_visibility.sql` migration already exists — the field is there.

### UI

Card grid of publicly shared documents:
- Document title, author, category, created date
- Click → opens document in read-only view
- Filter by category/tags
- Empty state: "No shared documents yet. Publish a document with Public visibility to share it here."

### Template "Share with Community"

The templates page already has a share action. Wire it to:
- Set the template's visibility to `'community'` / `is_public = true`
- The template then appears in the Community Shared Documents section under a "Templates" subsection

### Document visibility selector

In the document creation/edit form, the visibility dropdown must be **fully wired**:
- **Private** — author only
- **Team** — all tenant members (current default behaviour)
- **Public** — appears in Community Shared Documents

---

## 6. Objective O5 — Invite Flow (End-to-End)

### Missing pieces

1. **Accept invite page** — Supabase redirects to `/auth/callback` after link click. After authentication, if the user's JWT metadata contains `tenant_id` (set during invite), call `POST /api/invites/accept` to complete tenant membership, then redirect to `/dashboard`.

2. **Pending invites UI** — In `/dashboard/users`, below the Members card, show a "Pending Invitations" card. Fetch from `GET /api/invites/pending`. Each row shows: email, role, sent date, Resend button, Cancel button.

3. **Role preserved on accept** — The invited role must be stored in Supabase user metadata at invite time and applied on acceptance.

### New backend endpoints

```
GET    /api/invites/pending       list pending invites (admin only)
DELETE /api/invites/:id           cancel invite (admin only)
POST   /api/invites/:id/resend    resend invite email (admin only)
```

Query pending invites from Supabase:
```sql
SELECT id, email, raw_user_meta_data, created_at
FROM auth.users
WHERE raw_user_meta_data->>'tenant_id' = $tenantId
  AND confirmed_at IS NULL
```

### AuthContext flow

After sign-in, check if the user's JWT metadata has `tenant_id` set. If yes and no tenant membership row exists, call `acceptInvite` to create their `users` row, then redirect to `/dashboard`.

---

## 7. Objective O6 — Document Sharing & Collaboration

### Document Sharing

**UI**: In the document editor top-right area, a "Share" button opens a modal:
- "Copy link" — generates a `share_token` URL (anyone with the link can view)
- "Invite people" — type email/name, choose view or edit permission

**New migration**:

```sql
CREATE TABLE document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_with UUID REFERENCES users(id),
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
  share_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New backend endpoints**:

```
GET    /api/documents/:id/shares       list current shares
POST   /api/documents/:id/share-link   generate share link token
POST   /api/documents/:id/share        share with specific user
DELETE /api/documents/:id/shares/:sid  revoke share
GET    /api/share/:token               resolve share token → redirect to doc (public)
```

### Real-time Collaboration

The Yjs collab server is deployed (`fly.collab.toml`, `collab-server.ts`). Wire it to the editor:

1. Install `@hocuspocus/provider` or use `y-websocket`
2. In the document editor, initialise the provider pointing to the collab server URL from env
3. Show collaborator avatars in the document header when multiple users are present
4. Show presence cursors in the editor indicating who is editing where

---

## 8. Sidebar Structure After M3

**`mainNavigation`** (top of sidebar, always visible):
```
Dashboard
Community           ← add here
```

**`toolsNavigation`** (Tools collapsible section):
```
Content Audit
Templates
Team Chat           ← add here
```

**`adminNavigation`** (unchanged):
```
Settings
Users
Branding
Billing
```

---

## 9. Agent Breakdown (for parallel execution)

### Agent A — Database & Backend Infrastructure
**Scope**: `supabase/migrations/`, `backend/src/routes/`, `backend/src/server.ts`

1. Migration: `chat_channels`, `chat_messages`, `chat_reactions`, `chat_read_receipts` + RLS
2. Migration: `discussions`, `discussion_replies`, `discussion_views`, `discussion_likes`, `polls`, `poll_options`, `poll_votes` + RLS
3. Migration: `document_shares` + RLS
4. Create `backend/src/routes/discussions.ts` — all discussion + reply + poll routes
5. Create `backend/src/routes/chat.ts` — all team chat routes
6. Create `backend/src/routes/document-shares.ts` — all sharing routes
7. Update `backend/src/routes/invites.ts` — add pending/cancel/resend endpoints
8. Register all new route files in `backend/src/server.ts`

### Agent B — Users & Invites
**Scope**: `app/dashboard/users/page.tsx`, `app/dashboard/settings/users/page.tsx`, `lib/api/invites.ts`, `lib/api/users.ts`, `app/auth/`

1. Fix invite bug (catch always shows success)
2. Add inline role-change modal to users table
3. Add delete user with confirmation modal
4. Add pending invites card (calls `GET /api/invites/pending`)
5. Add admin-only guard (permission denied state for non-admins)
6. Merge `settings/users/page.tsx` functionality into `/dashboard/users` and remove duplicate
7. Implement accept-invite flow in auth callback

### Agent C — Community Forum
**Scope**: `app/dashboard/community/`, `lib/api/discussions.ts`, `components/layout/DashboardSidebar.tsx`

1. Add Community to `mainNavigation` in sidebar (below Dashboard)
2. Wire `community/page.tsx` to real `listDiscussions` API — remove mock data, add states
3. Wire `community/[id]/page.tsx` to real API — remove placeholder replies, wire reply/like
4. Replace Textarea in `new/page.tsx` with TipTap document editor component
5. Add template citation to new post
6. Add admin moderation actions (pin, lock, resolve, delete) to thread view

### Agent D — Team Chat
**Scope**: `app/dashboard/tools/team-chat/` (new dir), `DashboardSidebar.tsx`, `lib/api/chat.ts` (new)

1. Add Team Chat to `toolsNavigation` in sidebar
2. Create `lib/api/chat.ts` — all chat API functions
3. Create `app/dashboard/tools/team-chat/page.tsx` — full Slack-style UI
4. Implement Supabase Realtime subscription for live messages
5. Channel list, message list, send, reactions, thread sidebar, unread badges

### Agent E — Community Shared Documents & Document Sharing
**Scope**: `app/dashboard/community/shared-documents/` (new), document editor share modal, `lib/api/documents.ts`

1. Create `/dashboard/community/shared-documents` page — shows public docs from API
2. Add [Forum / Shared Documents] tab navigation in community layout
3. Add Share button + modal to document editor (link share + user share)
4. Wire visibility selector (Private/Team/Public) in document form to API
5. Templates "Share with Community" action → sets template public flag

---

## 10. Definition of Done

M3 is complete when all of the following pass:

- [ ] All 4 user roles enforce correct permissions across every page
- [ ] Invite flow works end-to-end: invite sent → email received → link clicked → user lands in correct tenant with correct role
- [ ] Pending invites visible in `/dashboard/users` with resend/cancel
- [ ] Community forum is fully live — zero hardcoded mock data
- [ ] Creating a discussion saves to DB, views increment, replies count updates accurately
- [ ] Polls work end-to-end
- [ ] Community appears in sidebar under Dashboard
- [ ] Team Chat works with real-time messages, channel persistence, reactions
- [ ] Team Chat appears in sidebar under Tools
- [ ] Community Shared Documents tab shows actual public-visibility documents
- [ ] Template "Share with Community" action works and surfaces documents in Shared Docs
- [ ] Document sharing modal generates share links and per-user grants
- [ ] Collab editing shows presence indicators when multiple users edit a document
- [ ] All placeholder text and mock data removed throughout community/users/chat
- [ ] Proper empty states in all new and updated pages
