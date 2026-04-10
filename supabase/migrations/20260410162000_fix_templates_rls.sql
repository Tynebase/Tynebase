-- Migration: Fix Templates RLS for Multi-Tenant Support
-- Description: Updates templates RLS policies to use get_user_tenant_ids() for multi-tenant support
-- This aligns templates with the same pattern used for documents, categories, and collections

BEGIN;

-- Drop existing templates policies
DROP POLICY IF EXISTS "templates_select" ON public.templates;
DROP POLICY IF EXISTS "templates_insert" ON public.templates;
DROP POLICY IF EXISTS "templates_update" ON public.templates;
DROP POLICY IF EXISTS "templates_delete" ON public.templates;
DROP POLICY IF EXISTS "super_admin_all_templates" ON public.templates;

-- Updated SELECT policy using multi-tenant function
CREATE POLICY "templates_select" ON public.templates
FOR SELECT TO authenticated
USING (
    -- Public approved templates (anyone can see)
    (visibility = 'public' AND is_approved = TRUE)
    -- OR global approved templates (tenant_id IS NULL)
    OR (tenant_id IS NULL AND is_approved = TRUE)
    -- OR templates in any tenant the user belongs to
    OR tenant_id = ANY(public.get_user_tenant_ids())
    -- OR super admin bypass
    OR public.is_super_admin()
);

-- Updated INSERT policy
CREATE POLICY "templates_insert" ON public.templates
FOR INSERT TO authenticated
WITH CHECK (
    -- Tenant admins can create templates in their tenant
    (tenant_id = ANY(public.get_user_tenant_ids())
    AND public.is_tenant_admin(tenant_id)
    AND created_by = auth.uid())
    -- OR super admin can create anywhere
    OR public.is_super_admin()
);

-- Updated UPDATE policy
CREATE POLICY "templates_update" ON public.templates
FOR UPDATE TO authenticated
USING (
    -- Own unapproved template in any of user's tenants
    (created_by = auth.uid()
    AND tenant_id = ANY(public.get_user_tenant_ids())
    AND is_approved = FALSE)
    -- OR tenant admin can update templates in their tenant
    OR (tenant_id = ANY(public.get_user_tenant_ids())
    AND public.is_tenant_admin(tenant_id))
    -- OR super admin
    OR public.is_super_admin()
)
WITH CHECK (
    -- Own unapproved template
    (created_by = auth.uid()
    AND tenant_id = ANY(public.get_user_tenant_ids())
    AND is_approved = FALSE)
    -- OR tenant admin in their tenant
    OR (tenant_id = ANY(public.get_user_tenant_ids())
    AND public.is_tenant_admin(tenant_id))
    -- OR super admin
    OR public.is_super_admin()
);

-- Updated DELETE policy
CREATE POLICY "templates_delete" ON public.templates
FOR DELETE TO authenticated
USING (
    -- Own unapproved template in any of user's tenants
    (created_by = auth.uid()
    AND tenant_id = ANY(public.get_user_tenant_ids())
    AND is_approved = FALSE)
    -- OR tenant admin can delete templates in their tenant
    OR (tenant_id = ANY(public.get_user_tenant_ids())
    AND public.is_tenant_admin(tenant_id))
    -- OR super admin
    OR public.is_super_admin()
);

COMMIT;
