-- Test Validation for Task 3.4: Job Completion Handlers
-- This script validates that jobs can be completed and failed correctly

-- Test 1: Insert a test job
INSERT INTO job_queue (tenant_id, type, status, payload, worker_id)
VALUES (
  '1521f0ae-4db7-4110-a993-c494535d9b00', -- test tenant
  'test_job',
  'processing',
  '{"test": "data"}'::jsonb,
  'test-worker-1'
)
RETURNING id, type, status, attempts;

-- Test 2: Verify job was inserted
SELECT 
  id,
  tenant_id,
  type,
  status,
  payload,
  worker_id,
  attempts,
  created_at
FROM job_queue
WHERE type = 'test_job'
ORDER BY created_at DESC
LIMIT 1;

-- Test 3: Simulate job completion (update status to completed)
-- Replace <JOB_ID> with the actual ID from Test 1
UPDATE job_queue
SET 
  status = 'completed',
  result = '{"output": "success", "tokens": 1500}'::jsonb,
  completed_at = NOW()
WHERE type = 'test_job' 
  AND status = 'processing'
RETURNING id, status, result, completed_at;

-- Test 4: Verify completed job
SELECT 
  id,
  type,
  status,
  result,
  completed_at,
  attempts
FROM job_queue
WHERE type = 'test_job' AND status = 'completed'
ORDER BY created_at DESC
LIMIT 1;

-- Test 5: Insert another test job for failure testing
INSERT INTO job_queue (tenant_id, type, status, payload, worker_id, attempts)
VALUES (
  '1521f0ae-4db7-4110-a993-c494535d9b00',
  'test_job_fail',
  'processing',
  '{"test": "failure"}'::jsonb,
  'test-worker-2',
  0
)
RETURNING id, type, status, attempts;

-- Test 6: Simulate job failure with retry (attempts < 3)
UPDATE job_queue
SET 
  status = 'pending',
  result = '{"error": "API timeout", "errorDetails": {"statusCode": 504}, "timestamp": "2026-01-25T12:00:00Z", "attempts": 1}'::jsonb,
  attempts = 1,
  next_retry_at = NOW() + INTERVAL '5 minutes',
  worker_id = NULL
WHERE type = 'test_job_fail' 
  AND status = 'processing'
RETURNING id, status, result, attempts, next_retry_at;

-- Test 7: Verify failed job with retry scheduled
SELECT 
  id,
  type,
  status,
  result,
  attempts,
  next_retry_at,
  worker_id
FROM job_queue
WHERE type = 'test_job_fail'
ORDER BY created_at DESC
LIMIT 1;

-- Test 8: Simulate permanent failure (attempts >= 3)
UPDATE job_queue
SET 
  status = 'failed',
  result = '{"error": "Max retries exceeded", "errorDetails": {}, "timestamp": "2026-01-25T12:15:00Z", "attempts": 3}'::jsonb,
  attempts = 3,
  completed_at = NOW()
WHERE type = 'test_job_fail'
RETURNING id, status, result, attempts, completed_at;

-- Test 9: Verify permanently failed job
SELECT 
  id,
  type,
  status,
  result,
  attempts,
  completed_at,
  next_retry_at
FROM job_queue
WHERE type = 'test_job_fail' AND status = 'failed'
ORDER BY created_at DESC
LIMIT 1;

-- Cleanup: Remove test jobs
DELETE FROM job_queue WHERE type IN ('test_job', 'test_job_fail');

-- Final verification: Confirm cleanup
SELECT COUNT(*) as remaining_test_jobs
FROM job_queue
WHERE type IN ('test_job', 'test_job_fail');
