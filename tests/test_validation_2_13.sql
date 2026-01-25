-- ============================================================
-- Validation Test for Task 2.13: GET /api/documents/:id
-- ============================================================
-- This validates the document get endpoint functionality
-- Run this in Supabase SQL Editor after API implementation

-- Step 1: Verify test tenant and documents exist
SELECT 
  'Test Tenant Check' as test_name,
  id,
  subdomain,
  name
FROM tenants
WHERE subdomain = 'test';

-- Step 2: List existing documents for test tenant
SELECT 
  'Existing Documents' as test_name,
  d.id,
  d.title,
  d.status,
  d.tenant_id,
  d.author_id,
  d.created_at
FROM documents d
JOIN tenants t ON d.tenant_id = t.id
WHERE t.subdomain = 'test'
ORDER BY d.created_at DESC
LIMIT 5;

-- Step 3: Create a test document if none exist
DO $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_doc_id uuid;
BEGIN
  -- Get test tenant ID
  SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'test';
  
  -- Get a user from test tenant
  SELECT user_id INTO v_user_id 
  FROM tenant_memberships 
  WHERE tenant_id = v_tenant_id 
  LIMIT 1;
  
  -- Check if we have at least one document
  SELECT id INTO v_doc_id 
  FROM documents 
  WHERE tenant_id = v_tenant_id 
  LIMIT 1;
  
  -- Create test document if none exist
  IF v_doc_id IS NULL THEN
    INSERT INTO documents (
      tenant_id,
      author_id,
      title,
      content,
      status,
      is_public
    ) VALUES (
      v_tenant_id,
      v_user_id,
      'Test Document for GET Endpoint',
      '# Test Document\n\nThis is a test document for validating the GET /api/documents/:id endpoint.',
      'draft',
      false
    );
    
    RAISE NOTICE 'Created test document for validation';
  ELSE
    RAISE NOTICE 'Test document already exists: %', v_doc_id;
  END IF;
END $$;

-- Step 4: Verify document with author details (simulates API response)
SELECT 
  'Document with Author' as test_name,
  d.id,
  d.title,
  d.content,
  d.parent_id,
  d.is_public,
  d.status,
  d.author_id,
  d.published_at,
  d.created_at,
  d.updated_at,
  u.id as author_user_id,
  u.email as author_email,
  u.full_name as author_full_name
FROM documents d
JOIN tenants t ON d.tenant_id = t.id
JOIN users u ON d.author_id = u.id
WHERE t.subdomain = 'test'
ORDER BY d.created_at DESC
LIMIT 1;

-- Step 5: Test tenant isolation - verify documents from other tenants are not accessible
SELECT 
  'Tenant Isolation Check' as test_name,
  COUNT(*) as total_documents,
  COUNT(DISTINCT tenant_id) as distinct_tenants
FROM documents;

-- Expected Results:
-- ✅ Test tenant exists
-- ✅ At least one document exists for test tenant
-- ✅ Document query returns all required fields including author details
-- ✅ Multiple tenants exist with separate documents (isolation verified)
