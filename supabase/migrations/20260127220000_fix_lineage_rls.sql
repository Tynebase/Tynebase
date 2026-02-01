-- Fix document_lineage RLS policies to allow service role access
-- The backend uses supabaseAdmin (service role) to insert lineage events

-- Drop existing policies
DROP POLICY IF EXISTS lineage_tenant_isolation ON document_lineage;
DROP POLICY IF EXISTS lineage_insert_policy ON document_lineage;

-- RLS Policy: Service role can do everything
CREATE POLICY lineage_service_role_all ON document_lineage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can view lineage for documents in their tenant
CREATE POLICY lineage_tenant_isolation ON document_lineage
  FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT id FROM documents 
      WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
    OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND is_super_admin = true
    )
  );

-- RLS Policy: Authenticated users cannot insert directly (only via backend/service role)
-- This ensures audit trail integrity
CREATE POLICY lineage_no_direct_insert ON document_lineage
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
