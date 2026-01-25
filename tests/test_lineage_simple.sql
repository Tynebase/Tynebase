-- Simple validation for Task 1.8: Document Lineage Table

-- Test 1: Insert test lineage events
INSERT INTO document_lineage (document_id, event_type, actor_id, metadata)
SELECT 
  d.id,
  'created'::lineage_event_type,
  d.author_id,
  '{"test": "validation"}'::jsonb
FROM documents d
LIMIT 1;

-- Test 2: Try to UPDATE (this should fail)
-- Uncomment to test: UPDATE document_lineage SET metadata = '{}' WHERE id = (SELECT id FROM document_lineage LIMIT 1);

-- Test 3: Try to DELETE (this should fail)  
-- Uncomment to test: DELETE FROM document_lineage WHERE id = (SELECT id FROM document_lineage LIMIT 1);

-- Verify records exist
SELECT 
  id,
  document_id,
  event_type,
  actor_id,
  metadata,
  created_at
FROM document_lineage
ORDER BY created_at DESC
LIMIT 5;
