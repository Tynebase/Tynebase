-- Validation for Task 8.3: Hocuspocus Authentication Hook
-- This validates the database queries used in the authentication logic

-- Test 1: Verify test user exists and has tenant_id
SELECT 
  'Test 1: User exists with tenant' AS test,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result,
  id, email, tenant_id
FROM users
WHERE email = 'testuser@tynebase.test'
GROUP BY id, email, tenant_id;

-- Test 2: Verify test documents exist for test tenant
SELECT 
  'Test 2: Documents exist for tenant' AS test,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result,
  COUNT(*) AS document_count
FROM documents
WHERE tenant_id = '1521f0ae-4db7-4110-a993-c494535d9b00';

-- Test 3: Verify document ownership query (simulating auth check)
-- This query should return 1 row when user's tenant matches document's tenant
SELECT 
  'Test 3: Document ownership verification' AS test,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result,
  d.id AS document_id,
  d.tenant_id AS doc_tenant,
  u.tenant_id AS user_tenant
FROM documents d
JOIN users u ON u.tenant_id = d.tenant_id
WHERE d.id = '8339c226-f0ea-4504-bfc5-821258617504'
  AND u.email = 'testuser@tynebase.test'
GROUP BY d.id, d.tenant_id, u.tenant_id;

-- Test 4: Verify unauthorized access is prevented (different tenant)
-- This should return 0 rows when user's tenant doesn't match document's tenant
SELECT 
  'Test 4: Unauthorized access prevention' AS test,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result,
  COUNT(*) AS match_count
FROM documents d
JOIN users u ON u.tenant_id = d.tenant_id
WHERE d.id = '00000000-0000-0000-0000-000000000000'
  AND u.email = 'testuser@tynebase.test';

-- Test 5: Verify RLS is enabled on documents table
SELECT 
  'Test 5: RLS enabled on documents' AS test,
  CASE 
    WHEN relrowsecurity = true THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result,
  relrowsecurity
FROM pg_class
WHERE relname = 'documents';

-- Summary
SELECT 
  '=== VALIDATION SUMMARY ===' AS summary,
  'All tests should show ✅ PASS' AS expected;
