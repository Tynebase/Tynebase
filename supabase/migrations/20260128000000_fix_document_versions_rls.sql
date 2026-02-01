-- Fix document_versions RLS policies to allow service role access
-- The backend uses supabaseAdmin (service role) to query document versions

-- Drop existing policies if they exist
DROP POLICY IF EXISTS document_versions_tenant_isolation ON document_versions;
DROP POLICY IF EXISTS document_versions_service_role_all ON document_versions;

-- RLS Policy: Service role can do everything (for backend queries)
CREATE POLICY document_versions_service_role_all ON document_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can view versions for documents in their tenant
CREATE POLICY document_versions_tenant_read ON document_versions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Note: Version inserts happen via trigger (SECURITY DEFINER) so no insert policy needed for authenticated users
