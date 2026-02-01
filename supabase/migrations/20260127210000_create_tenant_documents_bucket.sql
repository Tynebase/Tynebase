-- Create tenant-documents storage bucket for document assets (images, videos)
-- This bucket stores assets uploaded to documents

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-documents',
  'tenant-documents',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing overly permissive policies if they exist
DROP POLICY IF EXISTS "Service role can manage tenant-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view tenant-documents" ON storage.objects;

-- SECURE POLICIES: Enforce tenant isolation via folder structure
-- File path format: tenant-{tenant_id}/document-{document_id}/filename.ext

-- Policy: Users can upload assets to their tenant's documents folder
CREATE POLICY "tenant_documents_assets_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-documents'
  AND (storage.foldername(name))[1] = CONCAT('tenant-', (
    SELECT tenant_id::text FROM public.users WHERE id = auth.uid()
  ))
);

-- Policy: Users can view assets from their tenant's documents folder
CREATE POLICY "tenant_documents_assets_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tenant-documents'
  AND (storage.foldername(name))[1] = CONCAT('tenant-', (
    SELECT tenant_id::text FROM public.users WHERE id = auth.uid()
  ))
);

-- Policy: Users can update assets in their tenant's documents folder
CREATE POLICY "tenant_documents_assets_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-documents'
  AND (storage.foldername(name))[1] = CONCAT('tenant-', (
    SELECT tenant_id::text FROM public.users WHERE id = auth.uid()
  ))
);

-- Policy: Users can delete assets from their tenant's documents folder
CREATE POLICY "tenant_documents_assets_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-documents'
  AND (storage.foldername(name))[1] = CONCAT('tenant-', (
    SELECT tenant_id::text FROM public.users WHERE id = auth.uid()
  ))
);

-- Policy: Service role can manage all tenant-documents (for backend operations)
CREATE POLICY "service_role_tenant_documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'tenant-documents')
WITH CHECK (bucket_id = 'tenant-documents');
