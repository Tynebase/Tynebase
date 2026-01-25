-- Validation Script for Task 1.8: Document Lineage Table
-- Tests immutability constraints on document_lineage table

-- Test 1: Insert test lineage events (should succeed)
DO $$
DECLARE
  test_tenant_id UUID;
  test_user_id UUID;
  test_document_id UUID;
  lineage_id_1 UUID;
  lineage_id_2 UUID;
BEGIN
  -- Get or create test tenant
  INSERT INTO tenants (subdomain, name, tier)
  VALUES ('test-lineage', 'Test Lineage Corp', 'free')
  ON CONFLICT (subdomain) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO test_tenant_id;

  -- Get or create test user
  INSERT INTO users (tenant_id, email, full_name, role)
  VALUES (test_tenant_id, 'lineage-test@test.com', 'Lineage Test User', 'admin')
  ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
  RETURNING id INTO test_user_id;

  -- Create test document
  INSERT INTO documents (tenant_id, title, content, author_id, status)
  VALUES (test_tenant_id, 'Test Document for Lineage', 'Test content', test_user_id, 'draft')
  RETURNING id INTO test_document_id;

  -- Insert lineage event 1: document created
  INSERT INTO document_lineage (document_id, event_type, actor_id, metadata)
  VALUES (
    test_document_id, 
    'created', 
    test_user_id,
    '{"source": "manual_test"}'::jsonb
  )
  RETURNING id INTO lineage_id_1;

  -- Insert lineage event 2: document edited
  INSERT INTO document_lineage (document_id, event_type, actor_id, metadata)
  VALUES (
    test_document_id, 
    'edited', 
    test_user_id,
    '{"changes": "content updated"}'::jsonb
  )
  RETURNING id INTO lineage_id_2;

  RAISE NOTICE '✅ Test 1 PASSED: Successfully inserted % lineage events', 2;
  RAISE NOTICE 'Lineage IDs: %, %', lineage_id_1, lineage_id_2;

  -- Test 2: Attempt UPDATE (should fail)
  BEGIN
    UPDATE document_lineage 
    SET metadata = '{"modified": true}'::jsonb 
    WHERE id = lineage_id_1;
    
    RAISE EXCEPTION '❌ Test 2 FAILED: UPDATE was allowed (should have been blocked)';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%immutable%' THEN
        RAISE NOTICE '✅ Test 2 PASSED: UPDATE correctly prevented with message: %', SQLERRM;
      ELSE
        RAISE EXCEPTION '❌ Test 2 FAILED: Wrong error message: %', SQLERRM;
      END IF;
  END;

  -- Test 3: Attempt DELETE (should fail)
  BEGIN
    DELETE FROM document_lineage WHERE id = lineage_id_2;
    
    RAISE EXCEPTION '❌ Test 3 FAILED: DELETE was allowed (should have been blocked)';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%immutable%' THEN
        RAISE NOTICE '✅ Test 3 PASSED: DELETE correctly prevented with message: %', SQLERRM;
      ELSE
        RAISE EXCEPTION '❌ Test 3 FAILED: Wrong error message: %', SQLERRM;
      END IF;
  END;

  -- Verify both records still exist
  IF (SELECT COUNT(*) FROM document_lineage WHERE document_id = test_document_id) = 2 THEN
    RAISE NOTICE '✅ Test 4 PASSED: Both lineage records still exist (immutability confirmed)';
  ELSE
    RAISE EXCEPTION '❌ Test 4 FAILED: Expected 2 lineage records, found %', 
      (SELECT COUNT(*) FROM document_lineage WHERE document_id = test_document_id);
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ALL VALIDATION TESTS PASSED ✅';
  RAISE NOTICE '========================================';
END $$;
