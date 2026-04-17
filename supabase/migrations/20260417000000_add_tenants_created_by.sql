-- Migration: add tenants.created_by as authoritative workspace-owner field.
--
-- Background: `is_original_admin` was previously derived as
--   role = 'admin' AND users.original_tenant_id IS NULL
-- which also matches any freshly-invited admin who had no prior workspace
-- (their new row is inserted with original_tenant_id = NULL by design, since
-- they genuinely have no other home). That made invited admins look like the
-- workspace creator, causing the inviter to appear demoted in the members UI
-- and in bare-domain /me profile selection.
--
-- Fix: track workspace creator explicitly on the tenant row. The creator is
-- immutable for the life of the workspace. All downstream "is owner" logic
-- now consults this column instead of inferring from original_tenant_id.

-- Plain UUID (no FK): public.users has a composite PK (id, tenant_id), so a
-- single-column FK isn't possible. We enforce creator-exists at the application
-- layer during signup.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS created_by UUID;

CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON public.tenants(created_by);

-- Backfill: for each tenant, pick the earliest active admin whose
-- original_tenant_id is NULL (or equals the tenant id, the legacy "home"
-- marker). That's the best approximation of the workspace creator given
-- existing data. If no such row exists, leave NULL — /me will fall back to
-- the pre-existing heuristic.
UPDATE public.tenants t
SET created_by = sub.user_id
FROM (
  SELECT DISTINCT ON (u.tenant_id)
    u.tenant_id,
    u.id AS user_id
  FROM public.users u
  WHERE u.role = 'admin'
    AND u.status = 'active'
    AND (u.original_tenant_id IS NULL OR u.original_tenant_id = u.tenant_id)
  ORDER BY u.tenant_id, u.created_at ASC
) sub
WHERE t.id = sub.tenant_id
  AND t.created_by IS NULL;

COMMENT ON COLUMN public.tenants.created_by IS 'The user who created this workspace. Used as the authoritative owner/original-admin marker. Immutable once set.';
