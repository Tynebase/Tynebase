-- Simple validation for document_embeddings table

-- Check if table exists and show structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'document_embeddings'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'document_embeddings';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'document_embeddings';

-- Insert test embedding with existing tenant/document
INSERT INTO document_embeddings (
    document_id, 
    tenant_id, 
    chunk_index, 
    chunk_content, 
    embedding,
    metadata
) 
SELECT 
    d.id,
    d.tenant_id,
    0,
    'Test chunk content for validation',
    array_fill(0, ARRAY[3072])::vector,
    '{"headers": ["Test"], "breadcrumbs": ["Root > Test"]}'::jsonb
FROM documents d
LIMIT 1;

-- Verify insert
SELECT 
    id,
    chunk_index,
    chunk_content,
    array_length(embedding::real[], 1) as dimensions,
    metadata->>'headers' as headers,
    created_at
FROM document_embeddings;
