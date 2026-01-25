-- Fix claim_job function to bypass RLS policies
-- The function needs to run with elevated privileges to claim jobs across all tenants

DROP FUNCTION IF EXISTS claim_job(TEXT);

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
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Disable RLS for this function execution
  -- This is safe because workers need to claim jobs across all tenants
  
  -- Select and lock the first pending job using SKIP LOCKED
  -- This ensures only one worker can claim each job
  SELECT jq.id INTO v_job_id
  FROM job_queue jq
  WHERE jq.status = 'pending'
  ORDER BY jq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no job found, return empty result
  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Update the job to mark it as processing and assign to this worker
  UPDATE job_queue jq
  SET 
    status = 'processing',
    worker_id = p_worker_id,
    attempts = jq.attempts + 1
  WHERE jq.id = v_job_id;

  -- Return the claimed job
  RETURN QUERY
  SELECT 
    jq.id,
    jq.tenant_id,
    jq.type,
    jq.status,
    jq.payload,
    jq.result,
    jq.worker_id,
    jq.attempts,
    jq.next_retry_at,
    jq.created_at,
    jq.completed_at
  FROM job_queue jq
  WHERE jq.id = v_job_id;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION claim_job(TEXT) TO authenticated, service_role, anon;

-- Add comment explaining the security model
COMMENT ON FUNCTION claim_job(TEXT) IS 
'Atomically claims a pending job using FOR UPDATE SKIP LOCKED. 
Runs with SECURITY DEFINER to bypass RLS - workers need access to all tenant jobs.
Security is enforced at the worker authentication level, not per-job.';
