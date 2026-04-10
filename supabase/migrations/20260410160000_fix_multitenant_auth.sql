-- Migration: Fix Multi-Tenant Auth, RLS, and FK Constraints
-- Addresses:
--   1. get_user_tenant_id() returns only ONE tenant → replaced with get_user_tenant_ids()
--   2. RLS policies using single-tenant function → updated for multi-tenant
--   3. Missing FK constraints after composite PK migration → restored
--   4. Proper original_tenant_id preference in RLS

-- ============================================================================
-- 1. Create multi-tenant-aware RLS helper functions
-- ============================================================================

-- Returns ALL tenant_ids the current user belongs to (for multi-tenant RLS)
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT tenant_id FROM public.users
    WHERE users.id = auth.uid()
    AND users.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Keep backward-compat get_user_tenant_id() but prefer original_tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
DECLARE
  v_tid UUID;
BEGIN
  -- Prefer original_tenant_id (the user's home workspace)
  SELECT tenant_id INTO v_tid
  FROM public.users
  WHERE users.id = auth.uid()
    AND users.status = 'active'
    AND (original_tenant_id IS NULL OR original_tenant_id = tenant_id)
  LIMIT 1;

  IF v_tid IS NOT NULL THEN
    RETURN v_tid;
  END IF;

  -- Fallback: any active membership, prefer admin role
  SELECT tenant_id INTO v_tid
  FROM public.users
  WHERE users.id = auth.uid()
    AND users.status = 'active'
  ORDER BY
    CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  RETURN v_tid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Updated is_tenant_admin for composite PK
CREATE OR REPLACE FUNCTION public.is_tenant_admin(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.tenant_id = tenant_uuid
    AND users.role = 'admin'
    AND users.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Updated is_super_admin check
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_super_admin = TRUE
    AND users.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- ============================================================================
-- 2. Update RLS policies for multi-tenant users
-- ============================================================================

-- USERS table policies
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;
DROP POLICY IF EXISTS "super_admin_all_users" ON public.users;
DROP POLICY IF EXISTS "users_same_tenant" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "admins_update_tenant_users" ON public.users;
DROP POLICY IF EXISTS "admins_insert_tenant_users" ON public.users;

-- SELECT: Users can see users in ANY tenant they belong to, super admins see all
CREATE POLICY "users_select" ON public.users
FOR SELECT TO authenticated
USING (
    tenant_id = ANY(public.get_user_tenant_ids())
    OR public.is_super_admin()
);

-- INSERT: Tenant admins can insert users in their tenant, or super admins anywhere
-- Also allow service role (handled by supabaseAdmin bypassing RLS)
CREATE POLICY "users_insert" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
    public.is_tenant_admin(tenant_id)
    OR public.is_super_admin()
);

-- UPDATE: Own profile (any tenant row), tenant admin for same tenant, or super admin
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

-- TENANTS table policies
DROP POLICY IF EXISTS "super_admin_all_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "admins_update_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "tenant_context_variable" ON public.tenants;

-- SELECT: Users can see ALL tenants they belong to
CREATE POLICY "users_own_tenants" ON public.tenants
FOR SELECT TO authenticated
USING (
    id = ANY(public.get_user_tenant_ids())
    OR public.is_super_admin()
);

-- UPDATE: Admins can update their own tenant
CREATE POLICY "admins_update_own_tenant" ON public.tenants
FOR UPDATE TO authenticated
USING (
    public.is_tenant_admin(id)
    OR public.is_super_admin()
);

-- ALL: Super admins
CREATE POLICY "super_admin_all_tenants" ON public.tenants
FOR ALL TO authenticated
USING (public.is_super_admin());

-- Session variable support for API context
CREATE POLICY "tenant_context_variable" ON public.tenants
FOR SELECT TO authenticated
USING (
    id::text = current_setting('app.current_tenant_id', TRUE)
);

-- DOCUMENTS table: ensure users can see docs in all their tenants
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
FOR SELECT TO authenticated
USING (
    tenant_id = ANY(public.get_user_tenant_ids())
    OR public.is_super_admin()
    OR visibility = 'public'
);

-- ============================================================================
-- 3. Restore missing FK constraints from composite PK migration
-- ============================================================================

-- chat_messages.author_id → users(id, tenant_id)
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_author_id_fkey;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_author_id_fkey
  FOREIGN KEY (author_id, tenant_id) REFERENCES public.users(id, tenant_id)
  ON DELETE SET NULL NOT VALID;
ALTER TABLE public.chat_messages VALIDATE CONSTRAINT chat_messages_author_id_fkey;

-- chat_channels.created_by → users(id, tenant_id)
ALTER TABLE public.chat_channels
  DROP CONSTRAINT IF EXISTS chat_channels_created_by_fkey;
ALTER TABLE public.chat_channels
  ADD CONSTRAINT chat_channels_created_by_fkey
  FOREIGN KEY (created_by, tenant_id) REFERENCES public.users(id, tenant_id)
  ON DELETE SET NULL NOT VALID;
ALTER TABLE public.chat_channels VALIDATE CONSTRAINT chat_channels_created_by_fkey;

-- document_versions.created_by → users(id, tenant_id)
-- First check if document_versions has tenant_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_versions' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.document_versions DROP CONSTRAINT IF EXISTS document_versions_created_by_fkey';
    EXECUTE 'ALTER TABLE public.document_versions ADD CONSTRAINT document_versions_created_by_fkey FOREIGN KEY (created_by, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL NOT VALID';
    EXECUTE 'ALTER TABLE public.document_versions VALIDATE CONSTRAINT document_versions_created_by_fkey';
  END IF;
END $$;

-- document_shares.shared_with → users(id, tenant_id)
ALTER TABLE public.document_shares
  DROP CONSTRAINT IF EXISTS document_shares_shared_with_fkey;
ALTER TABLE public.document_shares
  ADD CONSTRAINT document_shares_shared_with_fkey
  FOREIGN KEY (shared_with, tenant_id) REFERENCES public.users(id, tenant_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.document_shares VALIDATE CONSTRAINT document_shares_shared_with_fkey;

-- document_reviews: (assigned_to, tenant_id) and (created_by, tenant_id)
ALTER TABLE public.document_reviews
  DROP CONSTRAINT IF EXISTS document_reviews_assigned_to_fkey;
ALTER TABLE public.document_reviews
  ADD CONSTRAINT document_reviews_assigned_to_fkey
  FOREIGN KEY (assigned_to, tenant_id) REFERENCES public.users(id, tenant_id)
  ON DELETE SET NULL NOT VALID;
ALTER TABLE public.document_reviews VALIDATE CONSTRAINT document_reviews_assigned_to_fkey;

ALTER TABLE public.document_reviews
  DROP CONSTRAINT IF EXISTS document_reviews_created_by_fkey;
ALTER TABLE public.document_reviews
  ADD CONSTRAINT document_reviews_created_by_fkey
  FOREIGN KEY (created_by, tenant_id) REFERENCES public.users(id, tenant_id)
  ON DELETE SET NULL NOT VALID;
ALTER TABLE public.document_reviews VALIDATE CONSTRAINT document_reviews_created_by_fkey;

-- tags.created_by → users(id, tenant_id)
ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_created_by_fkey;
ALTER TABLE public.tags
  ADD CONSTRAINT tags_created_by_fkey
  FOREIGN KEY (created_by, tenant_id) REFERENCES public.users(id, tenant_id)
  ON DELETE SET NULL NOT VALID;
ALTER TABLE public.tags VALIDATE CONSTRAINT tags_created_by_fkey;

-- templates.created_by → users(id, tenant_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'templates' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_created_by_fkey';
    EXECUTE 'ALTER TABLE public.templates ADD CONSTRAINT templates_created_by_fkey FOREIGN KEY (created_by, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL NOT VALID';
    EXECUTE 'ALTER TABLE public.templates VALIDATE CONSTRAINT templates_created_by_fkey';
  END IF;
END $$;

-- collection_documents.added_by → users(id, tenant_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'collection_documents' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.collection_documents DROP CONSTRAINT IF EXISTS collection_documents_added_by_fkey';
    EXECUTE 'ALTER TABLE public.collection_documents ADD CONSTRAINT collection_documents_added_by_fkey FOREIGN KEY (added_by, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL NOT VALID';
    EXECUTE 'ALTER TABLE public.collection_documents VALIDATE CONSTRAINT collection_documents_added_by_fkey';
  END IF;
END $$;

-- collection_members: user_id and invited_by → users(id, tenant_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'collection_members' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.collection_members DROP CONSTRAINT IF EXISTS collection_members_user_id_fkey';
    EXECUTE 'ALTER TABLE public.collection_members ADD CONSTRAINT collection_members_user_id_fkey FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE CASCADE NOT VALID';
    EXECUTE 'ALTER TABLE public.collection_members VALIDATE CONSTRAINT collection_members_user_id_fkey';

    EXECUTE 'ALTER TABLE public.collection_members DROP CONSTRAINT IF EXISTS collection_members_invited_by_fkey';
    EXECUTE 'ALTER TABLE public.collection_members ADD CONSTRAINT collection_members_invited_by_fkey FOREIGN KEY (invited_by, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL NOT VALID';
    EXECUTE 'ALTER TABLE public.collection_members VALIDATE CONSTRAINT collection_members_invited_by_fkey';
  END IF;
END $$;

-- query_usage.user_id → users(id, tenant_id)
ALTER TABLE public.query_usage
  DROP CONSTRAINT IF EXISTS query_usage_user_id_fkey;
ALTER TABLE public.query_usage
  ADD CONSTRAINT query_usage_user_id_fkey
  FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id)
  ON DELETE SET NULL NOT VALID;
ALTER TABLE public.query_usage VALIDATE CONSTRAINT query_usage_user_id_fkey;

-- ============================================================================
-- 4. Add tenant_id to tables that need it for FK constraints
--    (Only for tables used in PostgREST joins that currently lack it)
-- ============================================================================

-- chat_reactions: add tenant_id if missing, backfill from chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_reactions' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.chat_reactions ADD COLUMN tenant_id UUID;
    
    UPDATE public.chat_reactions cr
    SET tenant_id = cm.tenant_id
    FROM public.chat_messages cm
    WHERE cr.message_id = cm.id;

    ALTER TABLE public.chat_reactions
      ADD CONSTRAINT chat_reactions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

    ALTER TABLE public.chat_reactions
      ADD CONSTRAINT chat_reactions_user_id_fkey
      FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id)
      ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.chat_reactions VALIDATE CONSTRAINT chat_reactions_user_id_fkey;
  END IF;
END $$;

-- dm_messages: already has tenant_id, add FK
ALTER TABLE public.dm_messages
  DROP CONSTRAINT IF EXISTS dm_messages_author_id_fkey;
ALTER TABLE public.dm_messages
  ADD CONSTRAINT dm_messages_author_id_fkey
  FOREIGN KEY (author_id, tenant_id) REFERENCES public.users(id, tenant_id)
  ON DELETE SET NULL NOT VALID;
ALTER TABLE public.dm_messages VALIDATE CONSTRAINT dm_messages_author_id_fkey;

-- dm_participants: add tenant_id if missing, backfill from dm_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dm_participants' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.dm_participants ADD COLUMN tenant_id UUID;
    
    UPDATE public.dm_participants dp
    SET tenant_id = dc.tenant_id
    FROM public.dm_conversations dc
    WHERE dp.conversation_id = dc.id;

    ALTER TABLE public.dm_participants
      ADD CONSTRAINT dm_participants_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

    ALTER TABLE public.dm_participants
      ADD CONSTRAINT dm_participants_user_id_fkey
      FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id)
      ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.dm_participants VALIDATE CONSTRAINT dm_participants_user_id_fkey;
  END IF;
END $$;

-- dm_reactions: add tenant_id if missing, backfill from dm_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dm_reactions' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.dm_reactions ADD COLUMN tenant_id UUID;
    
    UPDATE public.dm_reactions dr
    SET tenant_id = dm.tenant_id
    FROM public.dm_messages dm
    WHERE dr.message_id = dm.id;

    ALTER TABLE public.dm_reactions
      ADD CONSTRAINT dm_reactions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

    ALTER TABLE public.dm_reactions
      ADD CONSTRAINT dm_reactions_user_id_fkey
      FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id)
      ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.dm_reactions VALIDATE CONSTRAINT dm_reactions_user_id_fkey;
  END IF;
END $$;

-- chat_read_receipts: add tenant_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_read_receipts' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.chat_read_receipts ADD COLUMN tenant_id UUID;
    
    UPDATE public.chat_read_receipts crr
    SET tenant_id = cc.tenant_id
    FROM public.chat_channels cc
    WHERE crr.channel_id = cc.id;

    ALTER TABLE public.chat_read_receipts
      ADD CONSTRAINT chat_read_receipts_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

    ALTER TABLE public.chat_read_receipts
      ADD CONSTRAINT chat_read_receipts_user_id_fkey
      FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id)
      ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.chat_read_receipts VALIDATE CONSTRAINT chat_read_receipts_user_id_fkey;
  END IF;
END $$;

-- notifications: already has tenant_id usually
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey';
    EXECUTE 'ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE CASCADE NOT VALID';
    EXECUTE 'ALTER TABLE public.notifications VALIDATE CONSTRAINT notifications_user_id_fkey';
  END IF;
END $$;

-- Add comments
COMMENT ON FUNCTION public.get_user_tenant_ids() IS 'Returns all tenant IDs the current user is a member of (multi-tenant RLS)';
COMMENT ON FUNCTION public.get_user_tenant_id() IS 'Returns the primary tenant ID, preferring original workspace then admin role';
