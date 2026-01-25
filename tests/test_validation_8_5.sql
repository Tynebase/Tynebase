-- Validation script for Task 8.5: Store Document Hook with Debounce
-- Tests: Y.js state storage, content field update, updated_at timestamp, RAG job dispatch

-- Prerequisites: Test document should exist and be edited via WebSocket

-- 1. Check if test document exists with yjs_state
SELECT 
  id,
  title,
  tenant_id,
  yjs_state IS NOT NULL as has_yjs_state,
  content IS NOT NULL as has_content,
  LENGTH(content) as content_length,
  updated_at,
  created_at
FROM documents
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
ORDER BY updated_at DESC
LIMIT 5;

-- 2. Verify content field is populated (not just yjs_state)
SELECT 
  id,
  title,
  SUBSTRING(content, 1, 100) as content_preview,
  LENGTH(content) as content_length,
  updated_at
FROM documents
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
  AND content IS NOT NULL
  AND LENGTH(content) > 0
ORDER BY updated_at DESC
LIMIT 3;

-- 3. Check for RAG index jobs dispatched for documents
SELECT 
  jq.id as job_id,
  jq.type,
  jq.status,
  jq.payload->>'document_id' as document_id,
  jq.created_at,
  jq.attempts,
  d.title as document_title
FROM job_queue jq
LEFT JOIN documents d ON d.id = (jq.payload->>'document_id')::uuid
WHERE jq.tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
  AND jq.type = 'rag_index'
ORDER BY jq.created_at DESC
LIMIT 10;

-- 4. Verify updated_at is recent (within last hour)
SELECT 
  id,
  title,
  updated_at,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_since_update
FROM documents
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- 5. Check for duplicate job prevention (should not have multiple pending jobs for same document)
SELECT 
  payload->>'document_id' as document_id,
  COUNT(*) as pending_job_count,
  ARRAY_AGG(id) as job_ids,
  ARRAY_AGG(status) as statuses
FROM job_queue
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
  AND type = 'rag_index'
  AND status IN ('pending', 'processing')
GROUP BY payload->>'document_id'
HAVING COUNT(*) > 1;

-- Expected Results:
-- Query 1: Should show documents with both yjs_state and content populated
-- Query 2: Should show content preview (markdown text extracted from Y.js)
-- Query 3: Should show rag_index jobs created after document edits
-- Query 4: Should show recently updated documents
-- Query 5: Should return 0 rows (no duplicate pending jobs)
