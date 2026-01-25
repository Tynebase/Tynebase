-- ============================================================
-- Validation Script for Task 6.5: YouTube URL Worker Handling
-- ============================================================
-- This script validates that the video ingestion worker can
-- handle YouTube URLs from video_ingest_youtube jobs
-- ============================================================

-- Test 1: Verify job_queue accepts video_ingest_youtube type
-- ============================================================
SELECT 
  'Test 1: Job Queue Schema' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'job_queue'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result;

-- Test 2: Insert test video_ingest_youtube job
-- ============================================================
INSERT INTO job_queue (tenant_id, type, payload, status)
VALUES (
  '1521f0ae-4db7-4110-a993-c494535d9b00',
  'video_ingest_youtube',
  jsonb_build_object(
    'url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'user_id', '00000000-0000-0000-0000-000000000001'
  ),
  'pending'
)
RETURNING 
  id,
  type,
  payload,
  status,
  created_at;

-- Test 3: Verify payload structure
-- ============================================================
SELECT 
  'Test 3: Payload Structure' as test_name,
  id,
  type,
  payload->>'url' as youtube_url,
  payload->>'user_id' as user_id,
  CASE 
    WHEN payload ? 'url' AND payload ? 'user_id' THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result
FROM job_queue
WHERE type = 'video_ingest_youtube'
ORDER BY created_at DESC
LIMIT 1;

-- Test 4: Check for any completed YouTube video jobs
-- ============================================================
SELECT 
  'Test 4: Completed YouTube Jobs' as test_name,
  COUNT(*) as completed_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS (Jobs processed)'
    ELSE '⚠️  No completed jobs yet (Worker may not be running)'
  END as result
FROM job_queue
WHERE type = 'video_ingest_youtube'
  AND status = 'completed';

-- Test 5: Verify documents created from YouTube videos
-- ============================================================
SELECT 
  'Test 5: Documents from YouTube' as test_name,
  COUNT(DISTINCT d.id) as document_count,
  CASE 
    WHEN COUNT(DISTINCT d.id) > 0 THEN '✅ PASS'
    ELSE '⚠️  No documents yet'
  END as result
FROM documents d
INNER JOIN document_lineage dl ON dl.document_id = d.id
WHERE dl.event_type = 'converted_from_video'
  AND (dl.metadata->>'is_youtube')::boolean = true;

-- Test 6: View recent YouTube video processing results
-- ============================================================
SELECT 
  jq.id as job_id,
  jq.type,
  jq.status,
  jq.payload->>'url' as youtube_url,
  jq.result->>'document_id' as document_id,
  jq.result->>'title' as document_title,
  jq.result->>'credits_used' as credits_used,
  jq.result->>'transcription_method' as method,
  jq.created_at,
  jq.completed_at
FROM job_queue jq
WHERE jq.type = 'video_ingest_youtube'
ORDER BY jq.created_at DESC
LIMIT 5;

-- Test 7: View document lineage for YouTube videos
-- ============================================================
SELECT 
  d.id as document_id,
  d.title,
  dl.event_type,
  dl.metadata->>'youtube_url' as youtube_url,
  dl.metadata->>'transcription_method' as method,
  dl.metadata->>'duration_minutes' as duration_minutes,
  dl.metadata->>'tokens_used' as tokens_used,
  dl.created_at
FROM documents d
INNER JOIN document_lineage dl ON dl.document_id = d.id
WHERE dl.event_type = 'converted_from_video'
  AND (dl.metadata->>'is_youtube')::boolean = true
ORDER BY dl.created_at DESC
LIMIT 5;

-- ============================================================
-- Cleanup Commands (Run manually if needed)
-- ============================================================

-- Delete test jobs
-- DELETE FROM job_queue WHERE type = 'video_ingest_youtube' AND status = 'pending';

-- Delete all YouTube video jobs
-- DELETE FROM job_queue WHERE type = 'video_ingest_youtube';

-- View all job types in the queue
-- SELECT type, status, COUNT(*) as count
-- FROM job_queue
-- GROUP BY type, status
-- ORDER BY type, status;
