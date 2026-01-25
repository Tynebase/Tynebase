-- Debug test for claim_job function
-- Run this in Supabase SQL Editor

-- Step 1: Insert a test job
INSERT INTO job_queue (tenant_id, type, status, payload)
VALUES ('1521f0ae-4db7-4110-a993-c494535d9b00', 'test_job', 'pending', '{"test": "data"}');

-- Step 2: Check if job was inserted
SELECT id, tenant_id, type, status, worker_id, attempts FROM job_queue WHERE type = 'test_job';

-- Step 3: Try to claim the job
SELECT * FROM claim_job('worker-test-1');

-- Step 4: Check job status after claim
SELECT id, tenant_id, type, status, worker_id, attempts FROM job_queue WHERE type = 'test_job';

-- Step 5: Clean up
DELETE FROM job_queue WHERE type = 'test_job';
