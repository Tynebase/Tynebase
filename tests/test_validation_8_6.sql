-- Task 8.6 Validation: Trigger Re-Index on Significant Changes
-- Tests RAG index job dispatch when content changes significantly

-- 1. Check if hasSignificantContentChange logic is implemented
-- Verify by checking recent RAG index jobs for documents with significant edits

-- Get documents that have been updated recently
SELECT 
    d.id,
    d.title,
    d.tenant_id,
    LENGTH(d.content) as content_length,
    d.updated_at,
    d.last_indexed_at,
    CASE 
        WHEN d.last_indexed_at IS NULL THEN 'Never indexed'
        WHEN d.updated_at > d.last_indexed_at THEN 'Needs reindex'
        ELSE 'Up to date'
    END as index_status
FROM documents d
WHERE d.tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
ORDER BY d.updated_at DESC
LIMIT 5;

-- 2. Check for RAG index jobs created for documents
SELECT 
    jq.id,
    jq.type,
    jq.status,
    jq.payload->>'document_id' as document_id,
    jq.created_at,
    jq.started_at,
    jq.completed_at,
    jq.error
FROM job_queue jq
WHERE jq.tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
    AND jq.type = 'rag_index'
ORDER BY jq.created_at DESC
LIMIT 10;

-- 3. Verify no duplicate pending/processing jobs for same document
SELECT 
    payload->>'document_id' as document_id,
    COUNT(*) as job_count,
    ARRAY_AGG(id) as job_ids,
    ARRAY_AGG(status) as statuses
FROM job_queue
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00'
    AND type = 'rag_index'
    AND status IN ('pending', 'processing')
GROUP BY payload->>'document_id'
HAVING COUNT(*) > 1;

-- Expected: No results (no duplicates)

-- 4. Check job_queue table structure supports the feature
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'job_queue'
    AND column_name IN ('id', 'tenant_id', 'type', 'status', 'payload', 'created_at')
ORDER BY ordinal_position;

-- 5. Verify RLS policies on job_queue
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
