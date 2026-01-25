-- Validation Test for Task 6.6: Document Import Endpoint
-- This validates that the document_convert job type can be inserted into job_queue

-- Test 1: Verify job_queue table exists and has correct structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'job_queue'
ORDER BY ordinal_position;

-- Test 2: Insert a test document_convert job
INSERT INTO job_queue (tenant_id, type, status, payload)
VALUES (
    '1521f0ae-4db7-4110-a993-c494535d9b00', -- test tenant
    'document_convert',
    'pending',
    '{
        "storage_path": "tenant-1521f0ae-4db7-4110-a993-c494535d9b00/test_document.pdf",
        "original_filename": "test_document.pdf",
        "file_size": 1024,
        "mimetype": "application/pdf",
        "user_id": "00000000-0000-0000-0000-000000000000",
        "file_extension": ".pdf"
    }'::jsonb
)
RETURNING id, tenant_id, type, status, created_at;

-- Test 3: Verify the job was inserted correctly
SELECT 
    id,
    tenant_id,
    type,
    status,
    payload->>'storage_path' as storage_path,
    payload->>'original_filename' as original_filename,
    payload->>'file_extension' as file_extension,
    created_at
FROM job_queue
WHERE type = 'document_convert'
ORDER BY created_at DESC
LIMIT 5;

-- Test 4: Clean up test data
DELETE FROM job_queue 
WHERE type = 'document_convert' 
AND payload->>'original_filename' = 'test_document.pdf';

-- Verification complete
SELECT 'Task 6.6 validation complete - document_convert job type is supported' as result;
