-- Migration: Fix RLS Infinite Recursion
-- Issue: Policies on users and tenants tables cause infinite recursion when querying with joins
-- Solution: Simplify policies to avoid self-referencing queries

-- Drop existing problematic policies
DROP POLICY IF EXISTS "super_admin_all_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "admins_update_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "super_admin_all_users" ON public.users;
DROP POLICY IF EXISTS "users_same_tenant" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "admins_update_tenant_users" ON public.users;
DROP POLICY IF EXISTS "admins_insert_tenant_users" ON public.users;

-- ============================================================
-- TENANTS TABLE POLICIES (Fixed)
-- ============================================================

-- Policy: Super admins can see all tenants (using security definer function)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "super_admin_all_tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (public.is_super_admin());

-- Policy: Users can see their own tenant (using security definer function)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id FROM public.users
    WHERE users.id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "users_own_tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (id = public.get_user_tenant_id());

-- Policy: Admins can update their own tenant (using security definer function)
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "admins_update_own_tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(id));

-- ============================================================
-- USERS TABLE POLICIES (Fixed)
-- ============================================================

-- Policy: Super admins can see all users
CREATE POLICY "super_admin_all_users"
ON public.users
FOR ALL
TO authenticated
USING (public.is_super_admin());

-- Policy: Users can see users in their own tenant
CREATE POLICY "users_same_tenant"
ON public.users
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- Policy: Users can update their own profile
CREATE POLICY "users_update_own_profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy: Admins can update users in their tenant
CREATE POLICY "admins_update_tenant_users"
ON public.users
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(tenant_id));

-- Policy: Admins can insert users in their tenant
CREATE POLICY "admins_insert_tenant_users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_admin(tenant_id));

-- Add comments for documentation
COMMENT ON FUNCTION public.is_super_admin() IS 'Security definer function to check if current user is super admin';
COMMENT ON FUNCTION public.get_user_tenant_id() IS 'Security definer function to get current user tenant ID';
COMMENT ON FUNCTION public.is_tenant_admin(UUID) IS 'Security definer function to check if current user is admin of given tenant';
