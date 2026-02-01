-- Migration: Fix RLS Performance Issues
-- 1. auth_rls_initplan: Wrap auth.uid() with (select auth.uid()) to prevent per-row re-evaluation
-- 2. multiple_permissive_policies: Consolidate multiple policies per role/action
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================================================
-- JOB_QUEUE TABLE - Add started_at column
-- ============================================================================

ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_job_queue_started_at ON job_queue(started_at);

-- ============================================================================
-- TENANTS TABLE - Fix and Consolidate Policies
-- ============================================================================

DROP POLICY IF EXISTS "super_admin_all_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "admins_update_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "tenant_context_variable" ON public.tenants;
DROP POLICY IF EXISTS "super_admin_insert_tenants" ON public.tenants;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete" ON public.tenants;

-- Consolidated SELECT policy for tenants
CREATE POLICY "tenants_select" ON public.tenants
FOR SELECT TO authenticated
USING (
    -- User's own tenant
    id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
    -- OR context variable (for API/testing)
    OR id::text = current_setting('app.current_tenant_id', TRUE)
);

-- Consolidated INSERT policy for tenants (super admin only)
CREATE POLICY "tenants_insert" ON public.tenants
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Consolidated UPDATE policy for tenants
CREATE POLICY "tenants_update" ON public.tenants
FOR UPDATE TO authenticated
USING (
    -- Tenant admin can update their own tenant
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = tenants.id 
        AND role = 'admin'
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Consolidated DELETE policy for tenants (super admin only)
CREATE POLICY "tenants_delete" ON public.tenants
FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- ============================================================================
-- USERS TABLE - Fix and Consolidate Policies
-- ============================================================================

DROP POLICY IF EXISTS "super_admin_all_users" ON public.users;
DROP POLICY IF EXISTS "users_same_tenant" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "admins_update_tenant_users" ON public.users;
DROP POLICY IF EXISTS "admins_insert_tenant_users" ON public.users;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

-- Consolidated SELECT policy for users
CREATE POLICY "users_select" ON public.users
FOR SELECT TO authenticated
USING (
    -- Same tenant
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = (SELECT auth.uid()) AND u.is_super_admin = TRUE)
);

-- Consolidated INSERT policy for users
CREATE POLICY "users_insert" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
    -- Admin in the target tenant
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = users.tenant_id 
        AND role = 'admin'
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = (SELECT auth.uid()) AND u.is_super_admin = TRUE)
);

-- Consolidated UPDATE policy for users
CREATE POLICY "users_update" ON public.users
FOR UPDATE TO authenticated
USING (
    -- Own profile
    id = (SELECT auth.uid())
    -- OR admin in same tenant
    OR EXISTS (
        SELECT 1 FROM public.users AS u 
        WHERE u.id = (SELECT auth.uid()) 
        AND u.tenant_id = users.tenant_id 
        AND u.role = 'admin'
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = (SELECT auth.uid()) AND u.is_super_admin = TRUE)
)
WITH CHECK (
    id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users AS u 
        WHERE u.id = (SELECT auth.uid()) 
        AND u.tenant_id = users.tenant_id 
        AND u.role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = (SELECT auth.uid()) AND u.is_super_admin = TRUE)
);

-- Consolidated DELETE policy for users (super admin only)
CREATE POLICY "users_delete" ON public.users
FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = (SELECT auth.uid()) AND u.is_super_admin = TRUE)
);

-- ============================================================================
-- DOCUMENTS TABLE - Fix and Consolidate Policies
-- ============================================================================

DROP POLICY IF EXISTS "super_admin_all_documents" ON public.documents;
DROP POLICY IF EXISTS "users_view_tenant_documents" ON public.documents;
DROP POLICY IF EXISTS "users_create_tenant_documents" ON public.documents;
DROP POLICY IF EXISTS "users_update_own_documents" ON public.documents;
DROP POLICY IF EXISTS "admins_update_tenant_documents" ON public.documents;
DROP POLICY IF EXISTS "users_delete_own_documents" ON public.documents;
DROP POLICY IF EXISTS "admins_delete_tenant_documents" ON public.documents;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "documents_select" ON public.documents;
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
DROP POLICY IF EXISTS "documents_update" ON public.documents;
DROP POLICY IF EXISTS "documents_delete" ON public.documents;

-- Consolidated SELECT policy for documents
CREATE POLICY "documents_select" ON public.documents
FOR SELECT TO authenticated
USING (
    -- Same tenant
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Consolidated INSERT policy for documents
CREATE POLICY "documents_insert" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
    -- Same tenant and author is current user
    (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND author_id = (SELECT auth.uid())
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Consolidated UPDATE policy for documents
CREATE POLICY "documents_update" ON public.documents
FOR UPDATE TO authenticated
USING (
    -- Own document in same tenant
    (
        author_id = (SELECT auth.uid())
        AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
    -- OR admin in same tenant
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = documents.tenant_id 
        AND role = 'admin'
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
)
WITH CHECK (
    (
        author_id = (SELECT auth.uid())
        AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = documents.tenant_id 
        AND role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Consolidated DELETE policy for documents
CREATE POLICY "documents_delete" ON public.documents
FOR DELETE TO authenticated
USING (
    -- Own document in same tenant
    (
        author_id = (SELECT auth.uid())
        AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
    -- OR admin in same tenant
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = documents.tenant_id 
        AND role = 'admin'
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- ============================================================================
-- TEMPLATES TABLE - Fix and Consolidate Policies
-- ============================================================================

DROP POLICY IF EXISTS "super_admin_all_templates" ON public.templates;
DROP POLICY IF EXISTS "users_view_public_templates" ON public.templates;
DROP POLICY IF EXISTS "users_view_tenant_templates" ON public.templates;
DROP POLICY IF EXISTS "users_view_global_templates" ON public.templates;
DROP POLICY IF EXISTS "users_create_tenant_templates" ON public.templates;
DROP POLICY IF EXISTS "admins_create_tenant_templates" ON public.templates;
DROP POLICY IF EXISTS "users_update_own_templates" ON public.templates;
DROP POLICY IF EXISTS "admins_update_tenant_templates" ON public.templates;
DROP POLICY IF EXISTS "users_delete_own_templates" ON public.templates;
DROP POLICY IF EXISTS "admins_delete_tenant_templates" ON public.templates;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "templates_select" ON public.templates;
DROP POLICY IF EXISTS "templates_insert" ON public.templates;
DROP POLICY IF EXISTS "templates_update" ON public.templates;
DROP POLICY IF EXISTS "templates_delete" ON public.templates;

-- Consolidated SELECT policy for templates
CREATE POLICY "templates_select" ON public.templates
FOR SELECT TO authenticated
USING (
    -- Public approved templates
    (visibility = 'public' AND is_approved = TRUE)
    -- OR global approved templates
    OR (tenant_id IS NULL AND is_approved = TRUE)
    -- OR same tenant
    OR tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Consolidated INSERT policy for templates
CREATE POLICY "templates_insert" ON public.templates
FOR INSERT TO authenticated
WITH CHECK (
    -- User creating internal template in their tenant
    (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND created_by = (SELECT auth.uid())
        AND visibility = 'internal'
        AND is_approved = FALSE
    )
    -- OR admin creating any template in their tenant
    OR (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = (SELECT auth.uid()) 
            AND tenant_id = templates.tenant_id 
            AND role = 'admin'
        )
        AND created_by = (SELECT auth.uid())
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Consolidated UPDATE policy for templates
CREATE POLICY "templates_update" ON public.templates
FOR UPDATE TO authenticated
USING (
    -- Own unapproved template
    (
        created_by = (SELECT auth.uid())
        AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND is_approved = FALSE
    )
    -- OR admin in same tenant
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = templates.tenant_id 
        AND role = 'admin'
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
)
WITH CHECK (
    (
        created_by = (SELECT auth.uid())
        AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND visibility = 'internal'
        AND is_approved = FALSE
    )
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = templates.tenant_id 
        AND role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Consolidated DELETE policy for templates
CREATE POLICY "templates_delete" ON public.templates
FOR DELETE TO authenticated
USING (
    -- Own unapproved template
    (
        created_by = (SELECT auth.uid())
        AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
        AND is_approved = FALSE
    )
    -- OR admin in same tenant
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = templates.tenant_id 
        AND role = 'admin'
    )
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- ============================================================================
-- DOCUMENT_EMBEDDINGS TABLE - Fix and Consolidate Policies
-- ============================================================================

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.document_embeddings;
DROP POLICY IF EXISTS "service_role_policy" ON public.document_embeddings;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "document_embeddings_all" ON public.document_embeddings;

-- Consolidated policy for document_embeddings
CREATE POLICY "document_embeddings_all" ON public.document_embeddings
FOR ALL TO authenticated
USING (
    -- Same tenant
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
    -- OR service role
    OR (SELECT auth.jwt()) ->> 'role' = 'service_role'
);

-- ============================================================================
-- JOB_QUEUE TABLE - Fix and Consolidate Policies
-- ============================================================================

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.job_queue;
DROP POLICY IF EXISTS "service_role_policy" ON public.job_queue;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "job_queue_all" ON public.job_queue;

-- Consolidated policy for job_queue
CREATE POLICY "job_queue_all" ON public.job_queue
FOR ALL TO authenticated
USING (
    -- Same tenant
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    -- OR super admin
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
    -- OR service role
    OR (SELECT auth.jwt()) ->> 'role' = 'service_role'
);

-- ============================================================================
-- DOCUMENT_LINEAGE TABLE - Fix Policy
-- ============================================================================

DROP POLICY IF EXISTS "lineage_tenant_isolation" ON public.document_lineage;
DROP POLICY IF EXISTS "lineage_insert_policy" ON public.document_lineage;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "document_lineage_select" ON public.document_lineage;
DROP POLICY IF EXISTS "document_lineage_insert" ON public.document_lineage;

-- Fixed SELECT policy for document_lineage
CREATE POLICY "document_lineage_select" ON public.document_lineage
FOR SELECT TO authenticated
USING (
    document_id IN (
        SELECT id FROM public.documents 
        WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- Fixed INSERT policy for document_lineage
CREATE POLICY "document_lineage_insert" ON public.document_lineage
FOR INSERT TO authenticated
WITH CHECK (
    document_id IN (
        SELECT id FROM public.documents 
        WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
);

-- ============================================================================
-- USER_CONSENTS TABLE - Fix Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own consents" ON public.user_consents;
DROP POLICY IF EXISTS "Users can insert own consents" ON public.user_consents;
DROP POLICY IF EXISTS "Users can update own consents" ON public.user_consents;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "user_consents_select" ON public.user_consents;
DROP POLICY IF EXISTS "user_consents_insert" ON public.user_consents;
DROP POLICY IF EXISTS "user_consents_update" ON public.user_consents;

-- Fixed policies for user_consents
CREATE POLICY "user_consents_select" ON public.user_consents
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_consents_insert" ON public.user_consents
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_consents_update" ON public.user_consents
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- CREDIT_POOLS TABLE - Fix Policies
-- ============================================================================

DROP POLICY IF EXISTS "credit_pools_select_own_tenant" ON public.credit_pools;
DROP POLICY IF EXISTS "credit_pools_insert_admin" ON public.credit_pools;
DROP POLICY IF EXISTS "credit_pools_update_admin" ON public.credit_pools;
DROP POLICY IF EXISTS "credit_pools_delete_admin" ON public.credit_pools;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "credit_pools_select" ON public.credit_pools;
DROP POLICY IF EXISTS "credit_pools_insert" ON public.credit_pools;
DROP POLICY IF EXISTS "credit_pools_update" ON public.credit_pools;
DROP POLICY IF EXISTS "credit_pools_delete" ON public.credit_pools;

-- Fixed policies for credit_pools
CREATE POLICY "credit_pools_select" ON public.credit_pools
FOR SELECT TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

CREATE POLICY "credit_pools_insert" ON public.credit_pools
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = credit_pools.tenant_id 
        AND role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

CREATE POLICY "credit_pools_update" ON public.credit_pools
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = (SELECT auth.uid()) 
        AND tenant_id = credit_pools.tenant_id 
        AND role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

CREATE POLICY "credit_pools_delete" ON public.credit_pools
FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- ============================================================================
-- QUERY_USAGE TABLE - Fix Policies
-- ============================================================================

DROP POLICY IF EXISTS "query_usage_select_own_tenant" ON public.query_usage;
DROP POLICY IF EXISTS "query_usage_insert_system" ON public.query_usage;
DROP POLICY IF EXISTS "query_usage_delete_admin" ON public.query_usage;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "query_usage_select" ON public.query_usage;
DROP POLICY IF EXISTS "query_usage_insert" ON public.query_usage;
DROP POLICY IF EXISTS "query_usage_delete" ON public.query_usage;

-- Fixed policies for query_usage
CREATE POLICY "query_usage_select" ON public.query_usage
FOR SELECT TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

CREATE POLICY "query_usage_insert" ON public.query_usage
FOR INSERT TO authenticated
WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

CREATE POLICY "query_usage_delete" ON public.query_usage
FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND is_super_admin = TRUE)
);

-- ============================================================================
-- TAGS TABLE - Fix Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view tags in their tenant" ON public.tags;
DROP POLICY IF EXISTS "Users can create tags in their tenant" ON public.tags;
DROP POLICY IF EXISTS "Users can update their own tags or admins can update any" ON public.tags;
DROP POLICY IF EXISTS "Users can delete their own tags or admins can delete any" ON public.tags;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "tags_select" ON public.tags;
DROP POLICY IF EXISTS "tags_insert" ON public.tags;
DROP POLICY IF EXISTS "tags_update" ON public.tags;
DROP POLICY IF EXISTS "tags_delete" ON public.tags;

-- Fixed policies for tags
CREATE POLICY "tags_select" ON public.tags
FOR SELECT TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
);

CREATE POLICY "tags_insert" ON public.tags
FOR INSERT TO authenticated
WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    AND created_by = (SELECT auth.uid())
);

CREATE POLICY "tags_update" ON public.tags
FOR UPDATE TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    AND (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = (SELECT auth.uid()) 
            AND tenant_id = tags.tenant_id 
            AND role IN ('admin')
        )
    )
);

CREATE POLICY "tags_delete" ON public.tags
FOR DELETE TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    AND (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = (SELECT auth.uid()) 
            AND tenant_id = tags.tenant_id 
            AND role IN ('admin')
        )
    )
);

-- ============================================================================
-- DOCUMENT_TAGS TABLE - Fix Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view document tags in their tenant" ON public.document_tags;
DROP POLICY IF EXISTS "Users can tag documents in their tenant" ON public.document_tags;
DROP POLICY IF EXISTS "Users can remove tags from documents in their tenant" ON public.document_tags;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "document_tags_select" ON public.document_tags;
DROP POLICY IF EXISTS "document_tags_insert" ON public.document_tags;
DROP POLICY IF EXISTS "document_tags_delete" ON public.document_tags;

-- Fixed policies for document_tags
CREATE POLICY "document_tags_select" ON public.document_tags
FOR SELECT TO authenticated
USING (
    document_id IN (
        SELECT id FROM public.documents 
        WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
);

CREATE POLICY "document_tags_insert" ON public.document_tags
FOR INSERT TO authenticated
WITH CHECK (
    document_id IN (
        SELECT id FROM public.documents 
        WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
);

CREATE POLICY "document_tags_delete" ON public.document_tags
FOR DELETE TO authenticated
USING (
    document_id IN (
        SELECT id FROM public.documents 
        WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    )
);

-- ============================================================================
-- CATEGORIES TABLE - Fix Policies
-- ============================================================================

DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;
-- Drop new policies if they exist (for idempotency)
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_update" ON public.categories;
DROP POLICY IF EXISTS "categories_delete" ON public.categories;

-- Fixed policies for categories
CREATE POLICY "categories_select" ON public.categories
FOR SELECT TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
);

CREATE POLICY "categories_insert" ON public.categories
FOR INSERT TO authenticated
WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    AND author_id = (SELECT auth.uid())
);

CREATE POLICY "categories_update" ON public.categories
FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()))
WITH CHECK (author_id = (SELECT auth.uid()));

CREATE POLICY "categories_delete" ON public.categories
FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()));

-- ============================================================================
-- COLLECTIONS TABLE - Fix Policies (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collections' AND table_schema = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "collections_select_policy" ON public.collections';
        EXECUTE 'DROP POLICY IF EXISTS "collections_insert_policy" ON public.collections';
        EXECUTE 'DROP POLICY IF EXISTS "collections_update_policy" ON public.collections';
        EXECUTE 'DROP POLICY IF EXISTS "collections_delete_policy" ON public.collections';
        -- Drop new policies if they exist (for idempotency)
        EXECUTE 'DROP POLICY IF EXISTS "collections_select" ON public.collections';
        EXECUTE 'DROP POLICY IF EXISTS "collections_insert" ON public.collections';
        EXECUTE 'DROP POLICY IF EXISTS "collections_update" ON public.collections';
        EXECUTE 'DROP POLICY IF EXISTS "collections_delete" ON public.collections';
        
        EXECUTE 'CREATE POLICY "collections_select" ON public.collections
            FOR SELECT TO authenticated
            USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1))';
        
        EXECUTE 'CREATE POLICY "collections_insert" ON public.collections
            FOR INSERT TO authenticated
            WITH CHECK (
                tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
                AND author_id = (SELECT auth.uid())
            )';
        
        EXECUTE 'CREATE POLICY "collections_update" ON public.collections
            FOR UPDATE TO authenticated
            USING (
                tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
                AND (
                    author_id = (SELECT auth.uid())
                    OR EXISTS (
                        SELECT 1 FROM public.users 
                        WHERE id = (SELECT auth.uid()) 
                        AND tenant_id = collections.tenant_id 
                        AND role = ''admin''
                    )
                )
            )';
        
        EXECUTE 'CREATE POLICY "collections_delete" ON public.collections
            FOR DELETE TO authenticated
            USING (
                tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
                AND (
                    author_id = (SELECT auth.uid())
                    OR EXISTS (
                        SELECT 1 FROM public.users 
                        WHERE id = (SELECT auth.uid()) 
                        AND tenant_id = collections.tenant_id 
                        AND role = ''admin''
                    )
                )
            )';
    END IF;
END $$;

-- ============================================================================
-- DOCUMENT_VERSIONS TABLE - Fix Policy (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_versions' AND table_schema = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "document_versions_tenant_isolation" ON public.document_versions';
        -- Drop new policies if they exist (for idempotency)
        EXECUTE 'DROP POLICY IF EXISTS "document_versions_all" ON public.document_versions';
        
        EXECUTE 'CREATE POLICY "document_versions_all" ON public.document_versions
            FOR ALL TO authenticated
            USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1))';
    END IF;
END $$;

-- ============================================================================
-- DOCUMENT_ASSETS TABLE - Fix Policy (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_assets' AND table_schema = 'public') THEN
        EXECUTE 'DROP POLICY IF EXISTS "document_assets_tenant_isolation" ON public.document_assets';
        EXECUTE 'DROP POLICY IF EXISTS "document_assets_select" ON public.document_assets';
        EXECUTE 'DROP POLICY IF EXISTS "document_assets_insert" ON public.document_assets';
        EXECUTE 'DROP POLICY IF EXISTS "document_assets_delete" ON public.document_assets';
        -- Drop new policies if they exist (for idempotency)
        EXECUTE 'DROP POLICY IF EXISTS "document_assets_all" ON public.document_assets';
        
        EXECUTE 'CREATE POLICY "document_assets_all" ON public.document_assets
            FOR ALL TO authenticated
            USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1))';
    END IF;
END $$;
