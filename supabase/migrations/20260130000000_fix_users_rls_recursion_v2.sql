-- Migration: Fix Users Table RLS Recursion (v2)
-- Issue: Policies on public.users query public.users, causing infinite recursion (42P17)
-- Solution: Use SECURITY DEFINER helper functions that bypass RLS

-- ============================================================================
-- First ensure helper functions exist with SECURITY DEFINER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id FROM public.users
    WHERE users.id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.is_tenant_admin(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.tenant_id = tenant_uuid
    AND users.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- ============================================================================
-- Drop and recreate users table policies using helper functions
-- ============================================================================

DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

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
    id = public.get_current_user_id()
    OR public.is_tenant_admin(tenant_id)
    OR public.is_super_admin()
)
WITH CHECK (
    id = public.get_current_user_id()
    OR public.is_tenant_admin(tenant_id)
    OR public.is_super_admin()
);

-- DELETE: Super admin only
CREATE POLICY "users_delete" ON public.users
FOR DELETE TO authenticated
USING (
    public.is_super_admin()
);
