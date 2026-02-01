-- Migration: Add service_role policy for tenant-uploads bucket
-- Fixes RLS violation when backend uploads legal documents

-- Policy: Service role can manage all tenant-uploads (for backend operations)
DROP POLICY IF EXISTS "service_role_tenant_uploads" ON storage.objects;
CREATE POLICY "service_role_tenant_uploads"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'tenant-uploads')
WITH CHECK (bucket_id = 'tenant-uploads');
