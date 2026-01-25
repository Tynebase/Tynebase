-- Test Validation for Task 6.7: Document Conversion Worker
-- This validates that the document conversion job handler works correctly

-- Test 1: Verify job_queue can accept document_convert jobs
SELECT 'Test 1: Verify job_queue accepts document_convert jobs' AS test;

INSERT INTO job_queue (tenant_id, type, payload, status)
VALUES (
  '1521f0ae-4db7-4110-a993-c494535d9b00',
  'document_convert',
  jsonb_build_object(
    'storage_path', 'test/sample.pdf',
    'original_filename', 'sample.pdf',
    'file_size', 12345,
    'mimetype', 'application/pdf',
    'user_id', '00000000-0000-0000-0000-000000000001'
  ),
  'pending'
)
RETURNING id, type, status, payload;

-- Test 2: Verify documents table can store converted content
SELECT 'Test 2: Verify documents table structure' AS test;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name IN ('id', 'tenant_id', 'title', 'content', 'status', 'author_id', 'created_at')
ORDER BY ordinal_position;

-- Test 3: Verify document_lineage supports conversion event types
SELECT 'Test 3: Verify document_lineage supports conversion events' AS test;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'document_lineage'
  AND column_name IN ('id', 'document_id', 'event_type', 'actor_id', 'metadata', 'created_at')
ORDER BY ordinal_position;

-- Test 4: Verify query_usage table for credit tracking
SELECT 'Test 4: Verify query_usage table structure' AS test;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'query_usage'
  AND column_name IN ('id', 'tenant_id', 'user_id', 'query_type', 'credits_used', 'metadata')
ORDER BY ordinal_position;

-- Test 5: Verify Supabase Storage bucket exists
SELECT 'Test 5: Verify documents storage bucket' AS test;

SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'documents';

-- Cleanup test job
DELETE FROM job_queue 
WHERE type = 'document_convert' 
  AND payload->>'storage_path' = 'test/sample.pdf';

SELECT 'All validation tests completed' AS result;
