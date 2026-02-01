-- Migration: Create proper categories table
-- Categories are folders for organizing documents, NOT documents themselves

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3b82f6',
    parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique category names within same parent for a tenant
    CONSTRAINT unique_category_name_per_parent UNIQUE (tenant_id, parent_id, name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON public.categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_author_id ON public.categories(author_id);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

-- Users can view all categories in their tenant
CREATE POLICY "categories_select_policy" ON public.categories
    FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    ));

-- Users can insert categories in their tenant
CREATE POLICY "categories_insert_policy" ON public.categories
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        AND author_id = auth.uid()
    );

-- Users can update their own categories
CREATE POLICY "categories_update_policy" ON public.categories
    FOR UPDATE
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- Users can delete their own categories
CREATE POLICY "categories_delete_policy" ON public.categories
    FOR DELETE
    USING (author_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON public.categories;
CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION update_categories_updated_at();

-- Update documents table to reference categories instead of self-referencing parent_id
-- Add category_id column to documents
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create index for category_id
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON public.documents(category_id);

-- Migrate existing category documents to new categories table
-- This moves documents with __CATEGORY__ prefix to the categories table
INSERT INTO public.categories (id, tenant_id, name, description, color, parent_id, author_id, created_at, updated_at)
SELECT 
    id,
    tenant_id,
    title as name,
    CASE 
        WHEN content LIKE '__CATEGORY__{%}' THEN 
            (regexp_replace(content, '^__CATEGORY__', ''))::jsonb->>'description'
        ELSE NULL
    END as description,
    COALESCE(
        CASE 
            WHEN content LIKE '__CATEGORY__{%}' THEN 
                (regexp_replace(content, '^__CATEGORY__', ''))::jsonb->>'color'
            ELSE NULL
        END,
        '#3b82f6'
    ) as color,
    NULL as parent_id,
    author_id,
    created_at,
    updated_at
FROM public.documents
WHERE content LIKE '__CATEGORY__%'
ON CONFLICT DO NOTHING;

-- Delete old category documents (they're now in the categories table)
DELETE FROM public.documents WHERE content LIKE '__CATEGORY__%';

-- Add comment for documentation
COMMENT ON TABLE public.categories IS 'Folder structure for organizing documents';
COMMENT ON COLUMN public.categories.parent_id IS 'Parent category for nested folder structure';
COMMENT ON COLUMN public.documents.category_id IS 'Category/folder this document belongs to';
