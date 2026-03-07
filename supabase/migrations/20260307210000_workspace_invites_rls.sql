-- Enable RLS on workspace_invites table.
-- All access goes through the backend using the service-role key (which
-- bypasses RLS), so no permissive policies are needed for normal operation.
-- This ensures that anonymous or authenticated clients cannot query the
-- table directly via the Supabase client.

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
