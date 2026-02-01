-- Migration: Fix remaining RLS performance issues
-- Fixes: tenants_select, document_versions, collection_documents, document_lineage

-- ============================================================================
-- FIX: tenants_select - wrap current_setting with (SELECT ...)
-- ============================================================================

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;

CREATE POLICY "tenants_select" ON public.tenants
FOR SELECT TO authenticated
USING (
    -- User's own tenant
    id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
    -- OR context variable (wrapped in SELECT)
    OR id::text = (SELECT current_setting('app.current_tenant_id', TRUE))
);

-- ============================================================================
-- FIX: document_versions - remove duplicate policies, fix auth.uid()
-- ============================================================================

DROP POLICY IF EXISTS "document_versions_all" ON public.document_versions;
DROP POLICY IF EXISTS "document_versions_tenant_read" ON public.document_versions;

CREATE POLICY "document_versions_select" ON public.document_versions
FOR ALL TO authenticated
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1));

-- ============================================================================
-- FIX: collection_documents - fix all 4 policies with (select auth.uid())
-- ============================================================================

DROP POLICY IF EXISTS "collection_documents_select_policy" ON public.collection_documents;
DROP POLICY IF EXISTS "collection_documents_insert_policy" ON public.collection_documents;
DROP POLICY IF EXISTS "collection_documents_update_policy" ON public.collection_documents;
DROP POLICY IF EXISTS "collection_documents_delete_policy" ON public.collection_documents;

-- SELECT: Users can view collection_documents if they can view the collection
CREATE POLICY "collection_documents_select" ON public.collection_documents
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.collections c
        WHERE c.id = collection_id
        AND c.tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND (
            c.visibility IN ('public', 'team')
            OR c.author_id = (SELECT auth.uid())
        )
    )
);

-- INSERT: Users can add documents to their own collections
CREATE POLICY "collection_documents_insert" ON public.collection_documents
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.collections c
        WHERE c.id = collection_id
        AND c.tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND c.author_id = (SELECT auth.uid())
    )
    AND added_by = (SELECT auth.uid())
);

-- UPDATE: Users can update document order in their own collections
CREATE POLICY "collection_documents_update" ON public.collection_documents
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.collections c
        WHERE c.id = collection_id
        AND c.tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND c.author_id = (SELECT auth.uid())
    )
);

-- DELETE: Users can remove documents from their own collections
CREATE POLICY "collection_documents_delete" ON public.collection_documents
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.collections c
        WHERE c.id = collection_id
        AND c.tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND c.author_id = (SELECT auth.uid())
    )
);

-- ============================================================================
-- FIX: document_lineage - remove duplicate INSERT policies
-- ============================================================================

DROP POLICY IF EXISTS "document_lineage_insert" ON public.document_lineage;
DROP POLICY IF EXISTS "lineage_no_direct_insert" ON public.document_lineage;

-- Single INSERT policy for document_lineage
CREATE POLICY "document_lineage_insert" ON public.document_lineage
FOR INSERT TO authenticated
WITH CHECK (
    document_id IN (
        SELECT id FROM public.documents 
        WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
);

-- ============================================================================
-- FIX: Unindexed foreign keys (INFO level but good to fix)
-- ============================================================================

-- Add index for collection_documents.added_by
CREATE INDEX IF NOT EXISTS idx_collection_documents_added_by ON public.collection_documents(added_by);

-- Add index for document_lineage.actor_id
CREATE INDEX IF NOT EXISTS idx_document_lineage_actor_id ON public.document_lineage(actor_id);
