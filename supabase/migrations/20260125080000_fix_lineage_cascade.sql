-- Migration: Fix Document Lineage Cascade Delete
-- Purpose: Allow CASCADE deletes from documents table while preventing direct deletes
-- Task: 2.16 - Implement Document Delete Endpoint

-- Drop existing triggers that block all deletes
DROP TRIGGER IF EXISTS prevent_lineage_delete ON document_lineage;
DROP TRIGGER IF EXISTS prevent_lineage_update ON document_lineage;

-- Create improved trigger function that allows cascade deletes
CREATE OR REPLACE FUNCTION prevent_direct_lineage_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow cascade deletes (triggered by document deletion)
  -- Block direct deletes (when not triggered by cascade)
  IF TG_OP = 'DELETE' THEN
    -- Check if this is a cascade delete by verifying the document still exists
    -- If document doesn't exist, this is a cascade delete - allow it
    IF NOT EXISTS (SELECT 1 FROM documents WHERE id = OLD.document_id) THEN
      RETURN OLD; -- Allow cascade delete
    END IF;
    -- Document still exists, so this is a direct delete attempt - block it
    RAISE EXCEPTION 'Document lineage records are immutable and cannot be directly deleted';
  END IF;
  
  -- Block all updates
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Document lineage records are immutable and cannot be modified';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers with improved logic
CREATE TRIGGER prevent_lineage_update
  BEFORE UPDATE ON document_lineage
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_lineage_modification();

CREATE TRIGGER prevent_lineage_delete
  BEFORE DELETE ON document_lineage
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_lineage_modification();

-- Add comment for documentation
COMMENT ON FUNCTION prevent_direct_lineage_modification() IS 'Prevents direct modification/deletion of lineage records while allowing CASCADE deletes from parent document deletion';
