-- Validation query for Task 1.6: Verify document_embeddings table structure and indexes

-- 1. Check table structure
\d document_embeddings

-- 2. List all indexes on document_embeddings
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'document_embeddings';

-- 3. Verify RLS is enabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'document_embeddings';

-- 4. List RLS policies
SELECT 
    policyname, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'document_embeddings';

-- 5. Insert test embedding (requires existing document and tenant)
-- First, get a test tenant and document
DO $$
DECLARE
    test_tenant_id UUID;
    test_doc_id UUID;
BEGIN
    -- Get first tenant
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    
    -- Get first document
    SELECT id INTO test_doc_id FROM documents LIMIT 1;
    
    -- If we have both, insert test embedding
    IF test_tenant_id IS NOT NULL AND test_doc_id IS NOT NULL THEN
        INSERT INTO document_embeddings (
            document_id, 
            tenant_id, 
            chunk_index, 
            chunk_content, 
            embedding,
            metadata
        ) VALUES (
            test_doc_id,
            test_tenant_id,
            0,
            'This is a test chunk for validation',
            array_fill(0, ARRAY[3072])::vector,
            '{"headers": ["Test Header"], "breadcrumbs": ["Test > Validation"]}'::jsonb
        );
        
        RAISE NOTICE 'Test embedding inserted successfully';
    ELSE
        RAISE NOTICE 'No test data available - skipping insert test';
    END IF;
END $$;

-- 6. Verify the insert worked
SELECT 
    id,
    document_id,
    tenant_id,
    chunk_index,
    chunk_content,
    array_length(embedding::real[], 1) as embedding_dimensions,
    metadata,
    created_at
FROM document_embeddings
LIMIT 5;
