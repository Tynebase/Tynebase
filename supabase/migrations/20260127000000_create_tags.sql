-- Create tags table for organizing documents
-- Tags can be created by users and associated with multiple documents

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create junction table for document-tag relationships (many-to-many)
CREATE TABLE IF NOT EXISTS public.document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate tag assignments to the same document
  CONSTRAINT unique_document_tag UNIQUE (document_id, tag_id)
);

-- Create unique index for case-insensitive tag name uniqueness per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_unique_name_per_tenant 
  ON public.tags(tenant_id, LOWER(name));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON public.tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON public.tags(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON public.tags(created_by);
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON public.document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON public.document_tags(tag_id);

-- Enable Row Level Security
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags table
-- Users can view tags in their tenant
CREATE POLICY "Users can view tags in their tenant"
  ON public.tags
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Users can create tags in their tenant
CREATE POLICY "Users can create tags in their tenant"
  ON public.tags
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Users can update tags they created or admins can update any tag in their tenant
CREATE POLICY "Users can update their own tags or admins can update any"
  ON public.tags
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND tenant_id = tags.tenant_id 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- Users can delete tags they created or admins can delete any tag in their tenant
CREATE POLICY "Users can delete their own tags or admins can delete any"
  ON public.tags
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND tenant_id = tags.tenant_id 
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- RLS Policies for document_tags table
-- Users can view document-tag relationships for documents in their tenant
CREATE POLICY "Users can view document tags in their tenant"
  ON public.document_tags
  FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM public.documents 
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Users can create document-tag relationships for documents they can access
CREATE POLICY "Users can tag documents in their tenant"
  ON public.document_tags
  FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM public.documents 
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Users can remove tags from documents they can access
CREATE POLICY "Users can remove tags from documents in their tenant"
  ON public.document_tags
  FOR DELETE
  USING (
    document_id IN (
      SELECT id FROM public.documents 
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Create updated_at trigger for tags
CREATE OR REPLACE FUNCTION public.update_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tags_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.document_tags TO authenticated;
