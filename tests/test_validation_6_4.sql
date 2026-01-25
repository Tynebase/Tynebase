-- ============================================================
-- Task 6.4 Validation: YouTube URL Endpoint
-- ============================================================
-- This validates that the video_ingest_youtube job type can be
-- inserted into the job queue and has the correct structure

-- Test 1: Verify job_queue table exists and has correct schema
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'job_queue'
ORDER BY ordinal_position;

-- Test 2: Insert a test job with video_ingest_youtube type
INSERT INTO job_queue (tenant_id, type, status, payload)
VALUES (
  '1521f0ae-4db7-4110-a993-c494535d9b00',
  'video_ingest_youtube',
  'pending',
  jsonb_build_object(
    'url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'user_id', 'db3ecc55-5240-4589-93bb-8e812519dca3'
  )
)
RETURNING id, tenant_id, type, status, payload, created_at;

-- Test 3: Verify the job was created correctly
SELECT 
  id,
  tenant_id,
  type,
  status,
  payload->>'url' as youtube_url,
  payload->>'user_id' as user_id,
  attempts,
  worker_id,
  created_at
FROM job_queue
WHERE type = 'video_ingest_youtube'
ORDER BY created_at DESC
LIMIT 5;

-- Test 4: Verify job count for video_ingest_youtube type
SELECT 
  COUNT(*) as total_youtube_jobs,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_jobs,
  COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_jobs,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs
FROM job_queue
WHERE type = 'video_ingest_youtube';

-- Test 5: Verify payload structure
SELECT 
  id,
  payload ? 'url' as has_url_field,
  payload ? 'user_id' as has_user_id_field,
  jsonb_typeof(payload->'url') as url_type,
  jsonb_typeof(payload->'user_id') as user_id_type
FROM job_queue
WHERE type = 'video_ingest_youtube'
ORDER BY created_at DESC
LIMIT 1;

-- Cleanup: Delete test jobs (optional - comment out if you want to keep them)
-- DELETE FROM job_queue WHERE type = 'video_ingest_youtube' AND status = 'pending';
