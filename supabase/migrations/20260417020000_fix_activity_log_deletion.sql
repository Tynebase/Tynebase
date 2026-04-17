-- Migration: Fix Activity Log Deletion (Robust version)
-- Purpose: Ensure document deletion events persist and are correctly filtered by tenant even after deletion

-- 1. Add 'deleted' to lineage_event_type if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'lineage_event_type' AND e.enumlabel = 'deleted'
    ) THEN
        ALTER TYPE public.lineage_event_type ADD VALUE 'deleted';
    END IF;
END
$$;

-- 2. Add tenant_id to document_lineage for orphan record isolation
-- This is critical for keeping logs of deleted documents while maintaining multitenancy
ALTER TABLE public.document_lineage
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill tenant_id from documents table for existing lineage records
UPDATE public.document_lineage dl
SET tenant_id = d.tenant_id
FROM public.documents d
WHERE dl.document_id = d.id
AND dl.tenant_id IS NULL;

-- 3. Update document_lineage foreign key for document_id to be ON DELETE SET NULL
-- This ensures the history records remain after the document is hard-deleted
ALTER TABLE public.document_lineage 
DROP CONSTRAINT IF EXISTS document_lineage_document_id_fkey;

ALTER TABLE public.document_lineage
ADD CONSTRAINT document_lineage_document_id_fkey 
FOREIGN KEY (document_id) 
REFERENCES public.documents(id) 
ON DELETE SET NULL;

-- 4. Create an index for tenant-based activity queries
CREATE INDEX IF NOT EXISTS idx_document_lineage_tenant_id ON public.document_lineage(tenant_id);
