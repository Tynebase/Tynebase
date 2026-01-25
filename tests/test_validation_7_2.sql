-- Validation Script for Task 7.2: RAG Index Job Handler
-- Tests that the RAG indexing worker can process documents and create embeddings

-- Prerequisites:
-- 1. Test tenant exists (subdomain: test, ID: 1521f0ae-4db7-4110-a993-c494535d9b00)
-- 2. Test user exists in the test tenant
-- 3. Backend worker is running

-- Step 1: Create a test document with markdown content
DO $$
DECLARE
  v_tenant_id UUID := '1521f0ae-4db7-4110-a993-c494535d9b00';
  v_user_id UUID;
  v_document_id UUID;
BEGIN
  -- Get a user from the test tenant
  SELECT id INTO v_user_id
  FROM users
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found in test tenant';
  END IF;

  -- Create test document with markdown content
  INSERT INTO documents (
    tenant_id,
    title,
    content,
    status,
    author_id
  ) VALUES (
    v_tenant_id,
    'RAG Index Test Document',
    E'# Introduction to RAG Systems\n\n' ||
    E'Retrieval-Augmented Generation (RAG) is a powerful technique that combines information retrieval with language generation.\n\n' ||
    E'## Key Components\n\n' ||
    E'### Document Chunking\n\n' ||
    E'The first step in RAG is to break documents into semantic chunks. This allows for more precise retrieval of relevant information.\n\n' ||
    E'### Vector Embeddings\n\n' ||
    E'Each chunk is converted into a vector embedding using models like Cohere Embed v4.0. These embeddings capture the semantic meaning of the text.\n\n' ||
    E'### Similarity Search\n\n' ||
    E'When a user asks a question, we convert the question into an embedding and search for the most similar document chunks using cosine similarity.\n\n' ||
    E'## Benefits\n\n' ||
    E'- Improved accuracy over pure language models\n\n' ||
    E'- Grounded responses based on actual documents\n\n' ||
    E'- Reduced hallucinations\n\n' ||
    E'## Implementation\n\n' ||
    E'TyneBase uses a 4-pass semantic chunking algorithm with hierarchical context preservation.',
    'draft',
    v_user_id
  )
  RETURNING id INTO v_document_id;

  RAISE NOTICE 'Created test document: %', v_document_id;

  -- Create a rag_index job for the document
  INSERT INTO job_queue (
    tenant_id,
    type,
    payload,
    status,
    priority
  ) VALUES (
    v_tenant_id,
    'rag_index',
    jsonb_build_object('document_id', v_document_id),
    'pending',
    5
  );

  RAISE NOTICE 'Created rag_index job for document: %', v_document_id;
  RAISE NOTICE 'Waiting for worker to process job...';
  RAISE NOTICE 'Check job_queue and document_embeddings tables after 10-20 seconds';
END $$;

-- Step 2: Wait for worker to process (run this after 10-20 seconds)
-- Check job status
SELECT 
  id,
  type,
  status,
  created_at,
  started_at,
  completed_at,
  result
FROM job_queue
WHERE type = 'rag_index'
ORDER BY created_at DESC
LIMIT 5;

-- Step 3: Verify embeddings were created
SELECT 
  d.id AS document_id,
  d.title,
  d.last_indexed_at,
  COUNT(de.id) AS embedding_count,
  MIN(de.chunk_index) AS min_chunk_index,
  MAX(de.chunk_index) AS max_chunk_index
FROM documents d
LEFT JOIN document_embeddings de ON d.id = de.document_id
WHERE d.title = 'RAG Index Test Document'
GROUP BY d.id, d.title, d.last_indexed_at;

-- Step 4: Inspect sample embeddings
SELECT 
  id,
  chunk_index,
  LEFT(chunk_content, 100) AS chunk_preview,
  metadata,
  array_length(embedding::float[], 1) AS embedding_dimensions,
  created_at
FROM document_embeddings
WHERE document_id IN (
  SELECT id FROM documents WHERE title = 'RAG Index Test Document'
)
ORDER BY chunk_index
LIMIT 5;

-- Step 5: Verify embedding dimensions (should be 1536 for Cohere Embed v4.0)
SELECT 
  document_id,
  chunk_index,
  array_length(embedding::float[], 1) AS dimensions
FROM document_embeddings
WHERE document_id IN (
  SELECT id FROM documents WHERE title = 'RAG Index Test Document'
)
LIMIT 1;

-- Expected Results:
-- 1. Job should be in 'completed' status
-- 2. document.last_indexed_at should be set
-- 3. Multiple embeddings should exist (5-10 chunks expected)
-- 4. Each embedding should have 1536 dimensions
-- 5. Chunk content should have contextual prefixes (Document: ..., Section: ...)
-- 6. Metadata should contain heading, level, type, tokenCount, hasContext

-- Cleanup (optional - run after validation)
-- DELETE FROM documents WHERE title = 'RAG Index Test Document';
