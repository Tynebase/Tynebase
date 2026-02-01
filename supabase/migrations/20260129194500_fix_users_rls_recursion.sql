-- Migration: Fix Users Table RLS Recursion
-- Issue: users_select, users_insert, users_update, users_delete policies query public.users
--        within policies on public.users, causing infinite recursion (42P17)
-- Solution: Use SECURITY DEFINER helper functions that bypass RLS

-- Drop the problematic policies from 20260129190000_fix_rls_performance.sql
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

-- Recreate policies using SECURITY DEFINER functions to avoid recursion

-- SELECT: Users can see users in their own tenant, super admins see all
CREATE POLICY "users_select" ON public.users
FOR SELECT TO authenticated
USING (
    tenant_id = public.get_user_tenant_id()
    OR public.is_super_admin()
);

-- INSERT: Tenant admins can insert users in their tenant, super admins can insert anywhere
CREATE POLICY "users_insert" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
    public.is_tenant_admin(tenant_id)
    OR public.is_super_admin()
);

-- UPDATE: Own profile, tenant admin for same tenant, or super admin
CREATE POLICY "users_update" ON public.users
FOR UPDATE TO authenticated
USING (
    id = (SELECT auth.uid())
    OR public.is_tenant_admin(tenant_id)
    OR public.is_super_admin()
)
WITH CHECK (
    id = (SELECT auth.uid())
    OR public.is_tenant_admin(tenant_id)
    OR public.is_super_admin()
);

-- DELETE: Super admin only
CREATE POLICY "users_delete" ON public.users
FOR DELETE TO authenticated
USING (
    public.is_super_admin()
);
