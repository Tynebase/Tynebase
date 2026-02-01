-- ============================================================================
-- Collections System Migration
-- ============================================================================
-- Collections allow users to curate documents into structured groups with
-- access control. Unlike categories (which are hierarchical), collections
-- are flat groupings that can include documents from any category.
-- ============================================================================

-- Create collections table
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    
    -- Access control
    visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'team', 'private')),
    
    -- Ownership
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Ordering
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create collection_documents junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.collection_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    
    -- Ordering within collection
    sort_order INTEGER DEFAULT 0,
    
    -- Who added and when
    added_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate entries
    UNIQUE(collection_id, document_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collections_tenant_id ON public.collections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_collections_author_id ON public.collections(author_id);
CREATE INDEX IF NOT EXISTS idx_collections_visibility ON public.collections(visibility);
CREATE INDEX IF NOT EXISTS idx_collection_documents_collection_id ON public.collection_documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_documents_document_id ON public.collection_documents(document_id);

-- Enable RLS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for collections
-- ============================================================================

-- Users can view collections based on visibility
CREATE POLICY "collections_select_policy" ON public.collections
    FOR SELECT
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND (
            visibility = 'public'
            OR visibility = 'team'
            OR author_id = auth.uid()
        )
    );

-- Users can insert their own collections
CREATE POLICY "collections_insert_policy" ON public.collections
    FOR INSERT
    WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND author_id = auth.uid()
    );

-- Users can update their own collections
CREATE POLICY "collections_update_policy" ON public.collections
    FOR UPDATE
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND author_id = auth.uid()
    )
    WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND author_id = auth.uid()
    );

-- Users can delete their own collections
CREATE POLICY "collections_delete_policy" ON public.collections
    FOR DELETE
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND author_id = auth.uid()
    );

-- ============================================================================
-- RLS Policies for collection_documents
-- ============================================================================

-- Users can view collection_documents if they can view the collection
CREATE POLICY "collection_documents_select_policy" ON public.collection_documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND (
                c.visibility = 'public'
                OR c.visibility = 'team'
                OR c.author_id = auth.uid()
            )
        )
    );

-- Users can add documents to their own collections
CREATE POLICY "collection_documents_insert_policy" ON public.collection_documents
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND c.author_id = auth.uid()
        )
        AND added_by = auth.uid()
    );

-- Users can update document order in their own collections
CREATE POLICY "collection_documents_update_policy" ON public.collection_documents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND c.author_id = auth.uid()
        )
    );

-- Users can remove documents from their own collections
CREATE POLICY "collection_documents_delete_policy" ON public.collection_documents
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND c.author_id = auth.uid()
        )
    );

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_collections_updated_at ON public.collections;
CREATE TRIGGER trigger_collections_updated_at
    BEFORE UPDATE ON public.collections
    FOR EACH ROW
    EXECUTE FUNCTION update_collections_updated_at();
