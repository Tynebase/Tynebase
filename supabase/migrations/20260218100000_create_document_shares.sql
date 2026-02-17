-- Migration: Create document_shares table for document sharing functionality
-- Part of Milestone 3 - Objective O4: Community Shared Documents
-- IDEMPOTENT: Safe to run multiple times

-- Create document_shares table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.document_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    shared_with UUID REFERENCES public.users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
    share_token TEXT UNIQUE,
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add tenant_id column if it doesn't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'document_shares' 
        AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.document_shares 
        ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
        
        -- Backfill tenant_id from documents table
        UPDATE public.document_shares ds
        SET tenant_id = d.tenant_id
        FROM public.documents d
        WHERE ds.document_id = d.id
        AND ds.tenant_id IS NULL;
        
        -- Make tenant_id NOT NULL after backfill
        ALTER TABLE public.document_shares 
        ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
END $$;

-- Create indexes for document_shares (IF NOT EXISTS handles idempotency)
CREATE INDEX IF NOT EXISTS idx_document_shares_tenant_id ON public.document_shares(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON public.document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_with ON public.document_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_document_shares_share_token ON public.document_shares(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_shares_created_by ON public.document_shares(created_by);

-- Enable RLS (idempotent)
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate (idempotent)
DROP POLICY IF EXISTS "Users can view document shares they created or are shared with" ON public.document_shares;
DROP POLICY IF EXISTS "Document owners can create shares" ON public.document_shares;
DROP POLICY IF EXISTS "Document owners can delete shares" ON public.document_shares;

-- Policy: Users can view shares for documents they own or are shared with them
CREATE POLICY "Users can view document shares they created or are shared with"
    ON public.document_shares
    FOR SELECT
    USING (
        created_by = auth.uid()
        OR shared_with = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_shares.document_id
            AND d.author_id = auth.uid()
        )
    );

-- Policy: Document owners can create shares
CREATE POLICY "Document owners can create shares"
    ON public.document_shares
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_shares.document_id
            AND d.author_id = auth.uid()
        )
    );

-- Policy: Document owners can delete shares
CREATE POLICY "Document owners can delete shares"
    ON public.document_shares
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_shares.document_id
            AND d.author_id = auth.uid()
        )
    );

-- Add comments (idempotent)
COMMENT ON TABLE public.document_shares IS 'Stores document sharing information including share links and user-specific shares';
COMMENT ON COLUMN public.document_shares.share_token IS 'Unique token for public share links (anyone with the link can access)';
COMMENT ON COLUMN public.document_shares.shared_with IS 'User ID if sharing with a specific user (NULL for link shares)';
COMMENT ON COLUMN public.document_shares.permission IS 'Permission level: view (read-only) or edit (can modify)';
COMMENT ON COLUMN public.document_shares.expires_at IS 'Optional expiration date for the share';
COMMENT ON COLUMN public.document_shares.tenant_id IS 'Tenant ID for multi-tenant isolation';
