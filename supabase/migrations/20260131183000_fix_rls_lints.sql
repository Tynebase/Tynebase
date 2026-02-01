-- Fix RLS lints: auth_rls_initplan + multiple_permissive_policies
-- Targets: tenants_select, audit_logs, document_reviews, document_versions

-- ============================================================================
-- tenants_select: wrap auth/current_setting with SELECT to avoid re-eval per row
-- ============================================================================
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;

CREATE POLICY "tenants_select" ON public.tenants
FOR SELECT TO authenticated
USING (
    id = (
        SELECT tenant_id
        FROM public.users
        WHERE id = (SELECT auth.uid())
        LIMIT 1
    )
    OR EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = (SELECT auth.uid())
          AND is_super_admin = TRUE
    )
    OR id::text = (SELECT current_setting('app.current_tenant_id', TRUE))
);

-- ============================================================================
-- audit_logs: wrap auth.uid and scope service_role policy to avoid duplicates
-- ============================================================================
DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_service_role ON public.audit_logs;

CREATE POLICY audit_logs_select_policy ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.users
            WHERE id = (SELECT auth.uid())
        )
        OR EXISTS (
            SELECT 1
            FROM public.users
            WHERE id = (SELECT auth.uid())
              AND is_super_admin = TRUE
        )
    );

CREATE POLICY audit_logs_insert_policy ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM public.users
            WHERE id = (SELECT auth.uid())
        )
        OR EXISTS (
            SELECT 1
            FROM public.users
            WHERE id = (SELECT auth.uid())
              AND is_super_admin = TRUE
        )
    );

CREATE POLICY audit_logs_service_role ON public.audit_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- document_reviews: wrap auth.uid and scope service_role policy
-- ============================================================================
DROP POLICY IF EXISTS document_reviews_select_policy ON public.document_reviews;
DROP POLICY IF EXISTS document_reviews_insert_policy ON public.document_reviews;
DROP POLICY IF EXISTS document_reviews_update_policy ON public.document_reviews;
DROP POLICY IF EXISTS document_reviews_delete_policy ON public.document_reviews;
DROP POLICY IF EXISTS document_reviews_service_role ON public.document_reviews;

CREATE POLICY document_reviews_select_policy ON public.document_reviews
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.users
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY document_reviews_insert_policy ON public.document_reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM public.users
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY document_reviews_update_policy ON public.document_reviews
    FOR UPDATE TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.users
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY document_reviews_delete_policy ON public.document_reviews
    FOR DELETE TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.users
            WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY document_reviews_service_role ON public.document_reviews
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- document_versions: avoid multiple permissive policies for authenticated
-- ============================================================================
DROP POLICY IF EXISTS document_versions_all ON public.document_versions;
DROP POLICY IF EXISTS document_versions_select ON public.document_versions;
DROP POLICY IF EXISTS document_versions_tenant_read ON public.document_versions;
DROP POLICY IF EXISTS document_versions_tenant_isolation ON public.document_versions;
DROP POLICY IF EXISTS document_versions_service_role_all ON public.document_versions;

CREATE POLICY document_versions_service_role_all ON public.document_versions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY document_versions_select ON public.document_versions
    FOR SELECT TO authenticated
    USING (
        tenant_id = (
            SELECT tenant_id
            FROM public.users
            WHERE id = (SELECT auth.uid())
            LIMIT 1
        )
    );
