-- Migration: Create document_versions table for version history
-- Stores snapshots of document content for version history feature

CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT, -- Markdown content at this version
    yjs_state BYTEA, -- Y.js binary state at this version
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique version numbers per document
    CONSTRAINT unique_document_version UNIQUE (document_id, version_number)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_tenant_id ON public.document_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON public.document_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_by ON public.document_versions(created_by);

-- Enable RLS
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access versions of documents in their tenant
DROP POLICY IF EXISTS document_versions_tenant_isolation ON public.document_versions;
CREATE POLICY document_versions_tenant_isolation ON public.document_versions
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Function to auto-create version on significant document changes
CREATE OR REPLACE FUNCTION public.create_document_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
    last_version_time TIMESTAMPTZ;
BEGIN
    -- Only create version if content changed significantly
    IF OLD.content IS DISTINCT FROM NEW.content AND NEW.content IS NOT NULL THEN
        -- Check if enough time has passed since last version (minimum 5 minutes)
        SELECT MAX(created_at) INTO last_version_time
        FROM public.document_versions
        WHERE document_id = NEW.id;
        
        IF last_version_time IS NULL OR (NOW() - last_version_time) > INTERVAL '5 minutes' THEN
            -- Get next version number
            SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
            FROM public.document_versions
            WHERE document_id = NEW.id;
            
            -- Insert new version
            INSERT INTO public.document_versions (
                document_id,
                tenant_id,
                version_number,
                title,
                content,
                yjs_state,
                created_by
            ) VALUES (
                NEW.id,
                NEW.tenant_id,
                next_version,
                NEW.title,
                NEW.content,
                NEW.yjs_state,
                NEW.author_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-versioning
DROP TRIGGER IF EXISTS document_auto_version ON public.documents;
CREATE TRIGGER document_auto_version
    AFTER UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.create_document_version();

-- Add comments for documentation
COMMENT ON TABLE public.document_versions IS 'Stores version history snapshots for documents';
COMMENT ON COLUMN public.document_versions.version_number IS 'Incrementing version number per document';
COMMENT ON COLUMN public.document_versions.content IS 'Markdown content at this version';
COMMENT ON COLUMN public.document_versions.yjs_state IS 'Y.js CRDT state at this version for potential restoration';
