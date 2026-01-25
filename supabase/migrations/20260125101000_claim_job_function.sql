-- Create claim_job function for atomic job claiming with SKIP LOCKED
-- This prevents race conditions when multiple workers try to claim jobs simultaneously

CREATE OR REPLACE FUNCTION claim_job(p_worker_id TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  type TEXT,
  status job_status,
  payload JSONB,
  result JSONB,
  worker_id TEXT,
  attempts INTEGER,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
) AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Select and lock the first pending job using SKIP LOCKED
  -- This ensures only one worker can claim each job
  SELECT job_queue.id INTO v_job_id
  FROM job_queue
  WHERE job_queue.status = 'pending'
  ORDER BY job_queue.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no job found, return empty result
  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Update the job to mark it as processing and assign to this worker
  UPDATE job_queue
  SET 
    status = 'processing',
    worker_id = p_worker_id,
    attempts = attempts + 1
  WHERE job_queue.id = v_job_id;

  -- Return the claimed job
  RETURN QUERY
  SELECT 
    job_queue.id,
    job_queue.tenant_id,
    job_queue.type,
    job_queue.status,
    job_queue.payload,
    job_queue.result,
    job_queue.worker_id,
    job_queue.attempts,
    job_queue.next_retry_at,
    job_queue.created_at,
    job_queue.completed_at
  FROM job_queue
  WHERE job_queue.id = v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION claim_job(TEXT) TO authenticated, service_role;
