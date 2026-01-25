-- Test Validation for Task 7.8: Manual Re-Index Endpoint
-- POST /api/sources/:id/reindex

-- Prerequisites: Test tenant and document must exist
-- Test tenant: subdomain 'test', ID '1521f0ae-4db7-4110-a993-c494535d9b00'

-- Step 1: Verify test tenant exists
SELECT 
  id, 
  subdomain, 
  name 
FROM tenants 
WHERE subdomain = 'test';

-- Step 2: Get a test document from the test tenant
SELECT 
  id, 
  title, 
  tenant_id,
  last_indexed_at,
  updated_at,
  created_at
FROM documents 
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
LIMIT 1;

-- Step 3: Check job_queue table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'job_queue' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 4: Query existing rag_index jobs for test tenant
SELECT 
  id,
  tenant_id,
  type,
  status,
  payload,
  created_at,
  updated_at
FROM job_queue
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
  AND type = 'rag_index'
ORDER BY created_at DESC
LIMIT 5;

-- Step 5: Verify RLS policies on job_queue
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'job_queue';

-- Expected Results:
-- 1. Test tenant should exist with subdomain 'test'
-- 2. At least one document should exist for the test tenant
-- 3. job_queue table should have columns: id, tenant_id, type, status, payload, created_at, updated_at
-- 4. After calling the API endpoint, a new rag_index job should appear in the queue
-- 5. RLS policies should be enabled on job_queue table
