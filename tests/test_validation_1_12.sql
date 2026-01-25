-- Validation Test for Task 1.12: Hybrid Search RPC Function
-- Tests the hybrid_search function with dummy data

-- Step 1: Verify the function exists
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'hybrid_search';

-- Step 2: Verify tsvector column exists
SELECT 
  column_name, 
  data_type,
  is_generated
FROM information_schema.columns
WHERE table_name = 'document_embeddings' 
  AND column_name = 'content_tsvector';

-- Step 3: Verify GIN index exists
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'document_embeddings' 
  AND indexname = 'idx_document_embeddings_content_tsvector';

-- Step 4: Insert test data (requires existing tenant and document)
-- First, get a tenant_id from existing data
DO $$
DECLARE
  test_tenant_id uuid;
  test_document_id uuid;
  test_user_id uuid;
  dummy_embedding vector(3072);
BEGIN
  -- Get first tenant
  SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
  
  -- Get first user
  SELECT id INTO test_user_id FROM users LIMIT 1;
  
  -- If no tenant exists, create one for testing
  IF test_tenant_id IS NULL THEN
    INSERT INTO tenants (subdomain, name, tier)
    VALUES ('test-hybrid-search', 'Test Tenant for Hybrid Search', 'base')
    RETURNING id INTO test_tenant_id;
    
    -- Create a test user
    INSERT INTO users (tenant_id, email, full_name, role)
    VALUES (test_tenant_id, 'test-hybrid@example.com', 'Test User', 'admin')
    RETURNING id INTO test_user_id;
  END IF;
  
  -- Create a test document
  INSERT INTO documents (tenant_id, title, content, author_id, status)
  VALUES (test_tenant_id, 'Test Document for Hybrid Search', 'This is test content', test_user_id, 'published')
  RETURNING id INTO test_document_id;
  
  -- Create dummy embedding (all zeros for simplicity)
  dummy_embedding := array_fill(0, ARRAY[3072])::vector(3072);
  
  -- Insert test embeddings with different content
  INSERT INTO document_embeddings (document_id, tenant_id, chunk_index, chunk_content, embedding)
  VALUES 
    (test_document_id, test_tenant_id, 0, 'PostgreSQL is a powerful open-source relational database system', dummy_embedding),
    (test_document_id, test_tenant_id, 1, 'Vector search enables semantic similarity matching using embeddings', dummy_embedding),
    (test_document_id, test_tenant_id, 2, 'Full-text search uses tsvector and tsquery for text matching', dummy_embedding),
    (test_document_id, test_tenant_id, 3, 'Hybrid search combines vector and text search for better results', dummy_embedding);
  
  RAISE NOTICE 'Test data created with tenant_id: %, document_id: %', test_tenant_id, test_document_id;
END $$;

-- Step 5: Test the hybrid_search function
-- Get tenant_id for the test
WITH test_params AS (
  SELECT id as tenant_id FROM tenants WHERE subdomain = 'test-hybrid-search' LIMIT 1
)
SELECT 
  hs.chunk_index,
  LEFT(hs.chunk_content, 60) || '...' AS content_preview,
  ROUND(hs.similarity_score::numeric, 4) AS similarity,
  ROUND(hs.text_rank_score::numeric, 4) AS text_rank,
  ROUND(hs.combined_score::numeric, 4) AS combined
FROM test_params tp,
LATERAL hybrid_search(
  array_fill(0, ARRAY[3072])::vector(3072),  -- dummy query embedding
  'vector search embeddings',                  -- query text
  tp.tenant_id,
  10                                           -- match count
) hs
ORDER BY hs.combined_score DESC;

-- Step 6: Verify tenant isolation (should return no results for non-existent tenant)
SELECT COUNT(*) as result_count
FROM hybrid_search(
  array_fill(0, ARRAY[3072])::vector(3072),
  'test query',
  '00000000-0000-0000-0000-000000000000'::uuid,  -- non-existent tenant
  10
);

-- Step 7: Test with empty query text (should still work with vector search only)
WITH test_params AS (
  SELECT id as tenant_id FROM tenants WHERE subdomain = 'test-hybrid-search' LIMIT 1
)
SELECT COUNT(*) as result_count
FROM test_params tp,
LATERAL hybrid_search(
  array_fill(0, ARRAY[3072])::vector(3072),
  '',  -- empty query text
  tp.tenant_id,
  10
) hs;

-- Cleanup test data
DELETE FROM document_embeddings 
WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = 'test-hybrid-search');

DELETE FROM documents 
WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = 'test-hybrid-search');

DELETE FROM users 
WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = 'test-hybrid-search');

DELETE FROM tenants 
WHERE subdomain = 'test-hybrid-search';

-- Final verification message
SELECT '✅ Hybrid search function validation complete' AS status;
