-- ============================================================================
-- One-off operational script — NOT a migration.
-- Restores the is_super_admin flag for the three platform owners.
-- Run this ONCE in the Supabase SQL editor (or via psql) for the prod project.
-- Safe to re-run: it is idempotent.
--
-- Why this is not a migration:
--   Migrations run in every environment automatically. Super-admin assignment
--   is a production-data concern, not a schema change, so it lives here under
--   supabase/ops/ and must be executed deliberately.
-- ============================================================================

BEGIN;

-- Show current state for these accounts before the update (for the audit trail
-- in the SQL editor output).
SELECT id, email, tenant_id, role, is_super_admin, status
FROM public.users
WHERE email IN ('dang4892@gmail.com', 'ennersmai@gmail.com', 'support@tynebase.com')
ORDER BY email, tenant_id;

-- Flip the flag on every row (a user may have multiple rows if they belong to
-- more than one tenant — we want super-admin on all of them).
UPDATE public.users
SET is_super_admin = TRUE,
    updated_at = NOW()
WHERE email IN ('dang4892@gmail.com', 'ennersmai@gmail.com', 'support@tynebase.com')
  AND is_super_admin IS DISTINCT FROM TRUE;

-- Verify.
SELECT id, email, tenant_id, role, is_super_admin, status
FROM public.users
WHERE email IN ('dang4892@gmail.com', 'ennersmai@gmail.com', 'support@tynebase.com')
ORDER BY email, tenant_id;

-- If everything looks correct in the result set, COMMIT.
-- If anything is wrong, ROLLBACK instead.
COMMIT;
