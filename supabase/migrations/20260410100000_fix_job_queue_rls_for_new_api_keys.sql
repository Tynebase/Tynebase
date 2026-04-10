-- Fix job_queue RLS policy to work with new Supabase API keys (sb_secret_*)
-- The new API keys may not have the 'role: service_role' claim in the JWT
-- Instead, we check if auth.uid() is null (service role keys don't have a user context)

-- Drop the old service_role_policy
DROP POLICY IF EXISTS service_role_policy ON job_queue;

-- Create a new policy that works with both old and new API keys
-- Service role keys (both old and new) have auth.uid() = null
CREATE POLICY service_role_policy ON job_queue
  FOR ALL
  USING (
    auth.uid() IS NULL
    OR
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Also update the tenant_isolation_policy to be more permissive for service role
DROP POLICY IF EXISTS tenant_isolation_policy ON job_queue;

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
