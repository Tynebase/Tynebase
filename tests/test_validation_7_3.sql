-- =====================================================
-- Validation Script for Task 7.3: Auto-Index on Document Save
-- =====================================================
-- Tests that PATCH /api/documents/:id automatically dispatches rag_index job
-- when content or yjs_state is updated

-- Prerequisites:
-- 1. Backend server running (npm run dev)
-- 2. Test tenant exists (subdomain: test, ID: 1521f0ae-4db7-4110-a993-c494535d9b00)
-- 3. Test user exists in that tenant

-- =====================================================
-- STEP 1: Create Test Document
-- =====================================================
-- Run this first to create a test document
INSERT INTO documents (
  id,
  tenant_id,
  author_id,
  title,
  content,
  status
)
VALUES (
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  '1521f0ae-4db7-4110-a993-c494535d9b00', -- test tenant
  (SELECT id FROM users WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00' LIMIT 1),
  'Test Document for Auto-Index',
  '# Initial Content\n\nThis is the initial content.',
  'draft'
)
ON CONFLICT (id) DO UPDATE
SET content = '# Initial Content\n\nThis is the initial content.',
    updated_at = NOW();

SELECT 'Test document created/updated' AS step_1_result;

-- =====================================================
-- STEP 2: Update Document via API
-- =====================================================
-- Use this curl command to update the document:
-- (Replace YOUR_JWT_TOKEN with actual JWT token)
/*
curl -X PATCH http://localhost:3000/api/documents/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-subdomain: test" \
  -d '{
    "content": "# Updated Content\n\nThis content has been updated and should trigger auto-indexing.\n\n## Section 1\nSome content here.\n\n## Section 2\nMore content here."
  }'
*/

-- =====================================================
-- STEP 3: Verify Job Was Dispatched
-- =====================================================
-- Wait 2-3 seconds after API call, then run this query
-- Should show a rag_index job with status 'pending' or 'processing'
SELECT 
  id,
  type,
  status,
  payload->>'document_id' AS document_id,
  created_at,
  claimed_at,
  completed_at
FROM job_queue
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
  AND type = 'rag_index'
  AND payload->>'document_id' = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: At least 1 job with status 'pending' or 'processing'

-- =====================================================
-- STEP 4: Test Duplicate Job Prevention
-- =====================================================
-- Update the document again immediately (before worker processes first job)
-- This should NOT create a duplicate job
/*
curl -X PATCH http://localhost:3000/api/documents/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-subdomain: test" \
  -d '{
    "content": "# Updated Again\n\nAnother update while job is still pending."
  }'
*/

-- Check job count - should still be 1 pending/processing job
SELECT 
  COUNT(*) AS pending_job_count,
  'Should be 1 (duplicate prevention working)' AS expected
FROM job_queue
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
  AND type = 'rag_index'
  AND status IN ('pending', 'processing')
  AND payload->>'document_id' = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

-- Expected: COUNT = 1 (no duplicate job created)

-- =====================================================
-- STEP 5: Wait for Job Completion and Verify Embeddings
-- =====================================================
-- Wait 10-20 seconds for worker to process the job
-- Then verify embeddings were created
SELECT 
  COUNT(*) AS embedding_count,
  'Should be > 0' AS expected
FROM document_embeddings
WHERE document_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

-- Check last_indexed_at was updated
SELECT 
  id,
  title,
  last_indexed_at,
  CASE 
    WHEN last_indexed_at IS NOT NULL THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS validation_status
FROM documents
WHERE id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

-- Expected: last_indexed_at should have a recent timestamp

-- =====================================================
-- STEP 6: Test Title-Only Update (Should NOT Trigger Index)
-- =====================================================
-- Update only the title (no content change)
-- This should NOT dispatch a rag_index job
/*
curl -X PATCH http://localhost:3000/api/documents/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-subdomain: test" \
  -d '{
    "title": "Updated Title Only"
  }'
*/

-- Check that no new job was created after title-only update
SELECT 
  COUNT(*) AS new_jobs_after_title_update,
  'Should be 0 (title-only updates should not trigger indexing)' AS expected
FROM job_queue
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
  AND type = 'rag_index'
  AND payload->>'document_id' = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
  AND created_at > (
    SELECT MAX(completed_at) 
    FROM job_queue 
    WHERE type = 'rag_index' 
      AND payload->>'document_id' = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
  );

-- Expected: COUNT = 0 (no new job for title-only update)

-- =====================================================
-- STEP 7: Cleanup (Optional)
-- =====================================================
-- Uncomment to clean up test data
/*
DELETE FROM document_embeddings WHERE document_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
DELETE FROM document_lineage WHERE document_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
DELETE FROM job_queue WHERE payload->>'document_id' = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
DELETE FROM documents WHERE id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
*/

-- =====================================================
-- VALIDATION SUMMARY
-- =====================================================
-- ✅ PASS Criteria:
-- 1. Job dispatched when content updated
-- 2. Duplicate job prevention works (only 1 pending job at a time)
-- 3. Embeddings created after job completion
-- 4. last_indexed_at timestamp updated
-- 5. Title-only updates do NOT trigger indexing
-- 6. API returns 200 success even if job dispatch fails
