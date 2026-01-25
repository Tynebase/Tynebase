-- Validation Test for Task 1.11: Storage Buckets with RLS
-- Verifies tenant-uploads and tenant-documents buckets exist with proper RLS policies

-- Test 1: Verify buckets exist
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('tenant-uploads', 'tenant-documents')
ORDER BY id;

-- Test 2: Verify RLS policies exist on storage.objects
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL as has_using_clause,
  with_check IS NOT NULL as has_with_check_clause
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE 'tenant_%'
ORDER BY policyname;

-- Test 3: Count policies per bucket (should be 4 each: INSERT, SELECT, UPDATE, DELETE)
SELECT 
  CASE 
    WHEN policyname LIKE 'tenant_uploads_%' THEN 'tenant-uploads'
    WHEN policyname LIKE 'tenant_documents_%' THEN 'tenant-documents'
  END as bucket,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE 'tenant_%'
GROUP BY 
  CASE 
    WHEN policyname LIKE 'tenant_uploads_%' THEN 'tenant-uploads'
    WHEN policyname LIKE 'tenant_documents_%' THEN 'tenant-documents'
  END
ORDER BY bucket;

-- Test 4: Verify RLS is enabled on storage.objects
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'storage' 
  AND tablename = 'objects';
