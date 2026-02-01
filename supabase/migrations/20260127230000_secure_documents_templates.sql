-- Migration: Secure Documents and Templates with RLS
-- CRITICAL: Enable Row Level Security on documents and templates tables
-- Enforce strict tenant isolation and role-based access control

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DOCUMENTS TABLE POLICIES
-- ============================================================

-- Policy: Super admins can see all documents
CREATE POLICY "super_admin_all_documents"
ON public.documents
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.is_super_admin = TRUE
    )
);

-- Policy: Users can view documents in their tenant
CREATE POLICY "users_view_tenant_documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
);

-- Policy: Users can create documents in their tenant
CREATE POLICY "users_create_tenant_documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
    AND author_id = auth.uid()
);

-- Policy: Users can update their own documents
CREATE POLICY "users_update_own_documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
    author_id = auth.uid()
    AND tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
)
WITH CHECK (
    author_id = auth.uid()
    AND tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
);

-- Policy: Admins can update any document in their tenant
CREATE POLICY "admins_update_tenant_documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Policy: Users can delete their own documents
CREATE POLICY "users_delete_own_documents"
ON public.documents
FOR DELETE
TO authenticated
USING (
    author_id = auth.uid()
    AND tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
);

-- Policy: Admins can delete any document in their tenant
CREATE POLICY "admins_delete_tenant_documents"
ON public.documents
FOR DELETE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- ============================================================
-- TEMPLATES TABLE POLICIES
-- ============================================================

-- Policy: Super admins can see all templates
CREATE POLICY "super_admin_all_templates"
ON public.templates
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.is_super_admin = TRUE
    )
);

-- Policy: Users can view public approved templates
CREATE POLICY "users_view_public_templates"
ON public.templates
FOR SELECT
TO authenticated
USING (
    visibility = 'public'
    AND is_approved = TRUE
);

-- Policy: Users can view templates in their tenant
CREATE POLICY "users_view_tenant_templates"
ON public.templates
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
);

-- Policy: Users can view global templates (tenant_id is NULL)
CREATE POLICY "users_view_global_templates"
ON public.templates
FOR SELECT
TO authenticated
USING (
    tenant_id IS NULL
    AND is_approved = TRUE
);

-- Policy: Users can create templates in their tenant
CREATE POLICY "users_create_tenant_templates"
ON public.templates
FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
    AND created_by = auth.uid()
    AND visibility = 'internal' -- Users can only create internal templates
    AND is_approved = FALSE -- New templates start unapproved
);

-- Policy: Admins can create templates in their tenant
CREATE POLICY "admins_create_tenant_templates"
ON public.templates
FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
    AND created_by = auth.uid()
);

-- Policy: Users can update their own templates (if not approved)
CREATE POLICY "users_update_own_templates"
ON public.templates
FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid()
    AND tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
    AND is_approved = FALSE -- Can't edit approved templates
)
WITH CHECK (
    created_by = auth.uid()
    AND tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
    AND visibility = 'internal' -- Users can't change to public
    AND is_approved = FALSE
);

-- Policy: Admins can update any template in their tenant
CREATE POLICY "admins_update_tenant_templates"
ON public.templates
FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Policy: Users can delete their own unapproved templates
CREATE POLICY "users_delete_own_templates"
ON public.templates
FOR DELETE
TO authenticated
USING (
    created_by = auth.uid()
    AND tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
    )
    AND is_approved = FALSE
);

-- Policy: Admins can delete any template in their tenant
CREATE POLICY "admins_delete_tenant_templates"
ON public.templates
FOR DELETE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON POLICY "super_admin_all_documents" ON public.documents IS 'Super admins have full access to all documents';
COMMENT ON POLICY "users_view_tenant_documents" ON public.documents IS 'Users can view documents in their tenant';
COMMENT ON POLICY "users_create_tenant_documents" ON public.documents IS 'Users can create documents in their tenant';
COMMENT ON POLICY "users_update_own_documents" ON public.documents IS 'Users can update their own documents';
COMMENT ON POLICY "admins_update_tenant_documents" ON public.documents IS 'Admins can update any document in their tenant';
COMMENT ON POLICY "users_delete_own_documents" ON public.documents IS 'Users can delete their own documents';
COMMENT ON POLICY "admins_delete_tenant_documents" ON public.documents IS 'Admins can delete any document in their tenant';

COMMENT ON POLICY "super_admin_all_templates" ON public.templates IS 'Super admins have full access to all templates';
COMMENT ON POLICY "users_view_public_templates" ON public.templates IS 'Users can view public approved templates';
COMMENT ON POLICY "users_view_tenant_templates" ON public.templates IS 'Users can view templates in their tenant';
COMMENT ON POLICY "users_view_global_templates" ON public.templates IS 'Users can view global approved templates';
COMMENT ON POLICY "users_create_tenant_templates" ON public.templates IS 'Users can create internal templates in their tenant';
COMMENT ON POLICY "admins_create_tenant_templates" ON public.templates IS 'Admins can create any template in their tenant';
COMMENT ON POLICY "users_update_own_templates" ON public.templates IS 'Users can update their own unapproved templates';
COMMENT ON POLICY "admins_update_tenant_templates" ON public.templates IS 'Admins can update any template in their tenant';
COMMENT ON POLICY "users_delete_own_templates" ON public.templates IS 'Users can delete their own unapproved templates';
COMMENT ON POLICY "admins_delete_tenant_templates" ON public.templates IS 'Admins can delete any template in their tenant';
