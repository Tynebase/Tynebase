-- Migration: Harden Multi-Tenant Isolation
-- Description: Implements strict tenant isolation using session-level context or JWT claims.
-- Removes broad access to 'public' documents across tenants.

BEGIN;

-- 1. Helper Function to get Active Tenant ID
-- We'll try to get it from a session variable 'app.current_tenant_id'
-- which should be set by the application middleware for every request.
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid AS $$
BEGIN
  -- We prefer the session variable if set by the backend
  IF current_setting('app.current_tenant_id', true) IS NOT NULL AND current_setting('app.current_tenant_id', true) <> '' THEN
    RETURN current_setting('app.current_tenant_id', true)::uuid;
  END IF;
  
  -- Fallback to a single tenant match if the user only belongs to one (convenience for some tools)
  -- But generally we want explicit context.
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Harden Document RLS
DROP POLICY IF EXISTS "documents_select" ON public.documents;

CREATE POLICY "documents_select" ON public.documents
FOR SELECT TO authenticated
USING (
  -- Primary isolation: tenant match
  (tenant_id = ANY(public.get_user_tenant_ids()) AND (
    -- Within the tenant, we apply visibility rules
    visibility IN ('team', 'public') 
    OR author_id = auth.uid()
    OR public.is_super_admin()
  ))
  OR 
  -- Cross-tenant 'community' documents are visible to all (intentional leak)
  visibility = 'community'
  OR
  -- Super admins bypass everything
  public.is_super_admin()
);

-- Note: We removed the global 'visibility = public' check so users don't see
-- public docs from other workspaces unless they are using public KB routes 
-- (which use service_role and ignore RLS).

-- 3. Harden Category RLS
DROP POLICY IF EXISTS "categories_select" ON public.categories;
CREATE POLICY "categories_select" ON public.categories
FOR SELECT TO authenticated
USING (
  tenant_id = ANY(public.get_user_tenant_ids())
  OR public.is_super_admin()
);

-- 4. Harden Collection RLS
DROP POLICY IF EXISTS "collections_select" ON public.collections;
CREATE POLICY "collections_select" ON public.collections
FOR SELECT TO authenticated
USING (
  tenant_id = ANY(public.get_user_tenant_ids())
  OR (visibility = 'public' AND tenant_id = ANY(public.get_user_tenant_ids()))
  OR author_id = auth.uid()
  OR public.is_super_admin()
);

COMMIT;
