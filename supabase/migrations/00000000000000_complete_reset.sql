-- Complete database reset - removes all existing objects
-- This migration runs before all others to ensure clean slate

-- Drop all storage buckets first
DELETE FROM storage.objects WHERE bucket_id IN ('tenant-uploads', 'tenant-documents', 'tenant-videos', 'tenant-assets');
DELETE FROM storage.buckets WHERE id IN ('tenant-uploads', 'tenant-documents', 'tenant-videos', 'tenant-assets');

-- Drop all tables in correct order
DROP TABLE IF EXISTS public.document_embeddings CASCADE;
DROP TABLE IF EXISTS public.document_versions CASCADE;
DROP TABLE IF EXISTS public.document_tags CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.lineage CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.consents CASCADE;
DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.credit_pools CASCADE;
DROP TABLE IF EXISTS public.query_usage CASCADE;
DROP TABLE IF EXISTS public.tenant_users CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS public.match_documents CASCADE;
DROP FUNCTION IF EXISTS public.hybrid_search CASCADE;
DROP FUNCTION IF EXISTS public.claim_job CASCADE;
DROP FUNCTION IF EXISTS public.update_tenant_uploads_size CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS public.job_status CASCADE;
DROP TYPE IF EXISTS public.lineage_event_type CASCADE;
DROP TYPE IF EXISTS public.tier CASCADE;
DROP TYPE IF EXISTS public.tenant_status CASCADE;

-- Drop extensions (will be recreated)
DROP EXTENSION IF EXISTS vector CASCADE;
