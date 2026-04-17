-- Migration: Add tenant_id to document_lineage
-- Purpose: Support isolation for orphaned history records

-- 1. Add tenant_id to document_lineage
ALTER TABLE public.document_lineage
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2. Backfill tenant_id from documents table for existing lineage records
UPDATE public.document_lineage dl
SET tenant_id = d.tenant_id
FROM public.documents d
WHERE dl.document_id = d.id
AND dl.tenant_id IS NULL;

-- 3. Create an index for tenant-based activity queries
CREATE INDEX IF NOT EXISTS idx_document_lineage_tenant_id ON public.document_lineage(tenant_id);
