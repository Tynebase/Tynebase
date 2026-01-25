-- Validation for Task 1.7: Job Queue Infrastructure

-- 1. Verify table structure
\d job_queue

-- 2. Verify enum type
\dT+ job_status

-- 3. Insert a test job
INSERT INTO job_queue (tenant_id, type, status, payload)
SELECT id, 'test_job', 'pending', '{"test": "data"}'::jsonb
FROM tenants
LIMIT 1
RETURNING id, tenant_id, type, status, payload, created_at;

-- 4. Test the claim query (FOR UPDATE SKIP LOCKED pattern)
-- This query should atomically claim a pending job
UPDATE job_queue 
SET status='processing', worker_id='test_worker_1'
WHERE id = (
  SELECT id 
  FROM job_queue 
  WHERE status='pending' 
  ORDER BY created_at 
  LIMIT 1 
  FOR UPDATE SKIP LOCKED
) 
RETURNING id, type, status, worker_id, created_at;

-- 5. Verify the job was claimed
SELECT id, type, status, worker_id, created_at
FROM job_queue
ORDER BY created_at DESC
LIMIT 5;
