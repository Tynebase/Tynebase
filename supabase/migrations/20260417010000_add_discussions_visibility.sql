-- Migration: add `is_public` to discussions to support public/private community threads.
--
-- Default is TRUE (tenant-wide visibility) to match current behaviour — existing
-- discussions stay visible to everyone in the workspace. When FALSE, the
-- discussion is only visible to the author and admins.

ALTER TABLE public.discussions
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_discussions_is_public ON public.discussions(is_public);

COMMENT ON COLUMN public.discussions.is_public IS 'Whether the discussion is visible to all workspace members. When false, only the author and workspace admins can see it.';
