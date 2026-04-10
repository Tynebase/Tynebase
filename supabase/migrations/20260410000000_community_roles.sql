-- Migration: Add Community Roles and Enable Public Community Access
-- Objective: Add 'community_contributor' and 'community_admin' roles.
-- Objective: Allow public (unauthenticated) read access to discussions.

-- 1. Update roles in public.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'editor', 'viewer', 'community_contributor', 'community_admin'));

-- 2. Update roles in public.workspace_invites
-- Note: The constraint name might be auto-generated or explicitly named.
-- We'll try to drop common patterns.
ALTER TABLE public.workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_role_check;
ALTER TABLE public.workspace_invites ADD CONSTRAINT workspace_invites_role_check 
CHECK (role IN ('admin', 'editor', 'viewer', 'community_contributor', 'community_admin'));

-- 3. Update RLS for Discussions to allow public read access
-- We drop existing policies first to redefine them.
DROP POLICY IF EXISTS "discussions_select" ON discussions;
CREATE POLICY "discussions_select" ON discussions
  FOR SELECT USING (true); -- Public read (will be filtered by tenant_id in API)

DROP POLICY IF EXISTS "discussion_replies_select" ON discussion_replies;
CREATE POLICY "discussion_replies_select" ON discussion_replies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "discussion_views_select" ON discussion_views;
CREATE POLICY "discussion_views_select" ON discussion_views
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "discussion_likes_select" ON discussion_likes;
CREATE POLICY "discussion_likes_select" ON discussion_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "discussion_reply_likes_select" ON discussion_reply_likes;
CREATE POLICY "discussion_reply_likes_select" ON discussion_reply_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "polls_select" ON polls;
CREATE POLICY "polls_select" ON polls
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "poll_options_select" ON poll_options;
CREATE POLICY "poll_options_select" ON poll_options
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "poll_votes_select" ON poll_votes;
CREATE POLICY "poll_votes_select" ON poll_votes
  FOR SELECT USING (true);

-- 4. Update RLS to allow community roles to write
-- 'discussions_insert'
DROP POLICY IF EXISTS "discussions_insert" ON discussions;
CREATE POLICY "discussions_insert" ON discussions
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND author_id = auth.uid()
    AND (
      SELECT role FROM users WHERE id = auth.uid()
    ) IN ('admin', 'editor', 'community_contributor', 'community_admin')
  );

-- 'discussion_replies_insert'
DROP POLICY IF EXISTS "discussion_replies_insert" ON discussion_replies;
CREATE POLICY "discussion_replies_insert" ON discussion_replies
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND author_id = auth.uid()
    AND (
      SELECT role FROM users WHERE id = auth.uid()
    ) IN ('admin', 'editor', 'community_contributor', 'community_admin')
  );

-- Community Admins can moderate (update/delete any in their tenant)
-- We'll add 'community_admin' to the existing update/delete policies pattern.

DROP POLICY IF EXISTS "discussions_update" ON discussions;
CREATE POLICY "discussions_update" ON discussions
  FOR UPDATE USING (
    author_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'editor', 'community_admin')
    )
  );

DROP POLICY IF EXISTS "discussions_delete" ON discussions;
CREATE POLICY "discussions_delete" ON discussions
  FOR DELETE USING (
    author_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'community_admin')
    )
  );
