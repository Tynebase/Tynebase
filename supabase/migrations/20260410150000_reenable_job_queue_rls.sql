-- Re-enable RLS on job_queue with the fixed policies
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_policy ON job_queue;
DROP POLICY IF EXISTS service_role_policy ON job_queue;

-- RLS Policy: Users can only access jobs from their tenant
CREATE POLICY tenant_isolation_policy ON job_queue
  FOR ALL
  USING (
    auth.uid() IS NULL
    OR
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- RLS Policy: Service role can access all jobs
CREATE POLICY service_role_policy ON job_queue
  FOR ALL
  USING (
    auth.uid() IS NULL
    OR
    auth.jwt() ->> 'role' = 'service_role'
  );
