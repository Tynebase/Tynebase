-- Migration: Enable Multi-Tenant Identity
-- Objective: Allow a single Supabase User ID to hold memberships in multiple tenants simultaneously.

-- 1. Drop constraints that rely on users(id) being a single-column primary key
-- We'll do this first to avoid dependency errors.

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_author_id_fkey;
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_created_by_fkey;
ALTER TABLE public.chat_assignments DROP CONSTRAINT IF EXISTS chat_assignments_user_id_fkey;
ALTER TABLE public.workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_invited_by_fkey;
ALTER TABLE public.document_shares DROP CONSTRAINT IF EXISTS document_shares_shared_by_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.collection_members DROP CONSTRAINT IF EXISTS collection_members_user_id_fkey;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

-- 2. Modify the users table primary key
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE public.users ADD PRIMARY KEY (id, tenant_id);

-- 3. Re-create foreign keys as composite keys (id, tenant_id)
-- This ensures that records are always linked to the correct tenant profile.

-- Documents
ALTER TABLE public.documents 
ADD CONSTRAINT documents_author_tenant_fkey 
FOREIGN KEY (author_id, tenant_id) 
REFERENCES public.users (id, tenant_id) ON DELETE CASCADE;

-- Templates
ALTER TABLE public.templates 
ADD CONSTRAINT templates_creator_tenant_fkey 
FOREIGN KEY (created_by, tenant_id) 
REFERENCES public.users (id, tenant_id) ON DELETE CASCADE;

-- Notifications (Note: Some tables might not have tenant_id yet, we use id only if we must, 
-- but composite is safer for isolated data)
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_user_tenant_fkey 
FOREIGN KEY (user_id, tenant_id) 
REFERENCES public.users (id, tenant_id) ON DELETE CASCADE;

-- Audit Logs
ALTER TABLE public.audit_logs 
ADD CONSTRAINT audit_logs_actor_tenant_fkey 
FOREIGN KEY (actor_id, tenant_id) 
REFERENCES public.users (id, tenant_id) ON DELETE CASCADE;

-- 4. Add Unique constraint for (email, tenant_id)
-- This prevents a user from joining the same community twice with the same email.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_tenant_key;
ALTER TABLE public.users ADD CONSTRAINT users_email_tenant_key UNIQUE (email, tenant_id);

-- 5. Comments
COMMENT ON TABLE public.users IS 'Supports multi-tenant identities. A single Supabase ID can have multiple rows, one per tenant membership.';
