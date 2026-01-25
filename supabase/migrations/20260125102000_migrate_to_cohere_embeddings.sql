-- Migration: Update embeddings to use Cohere Embed v4.0 (1536 dimensions)
-- Changes vector dimensions from 3072 (OpenAI text-embedding-3-large) to 1536 (Cohere Embed v4.0)
-- This migration will:
-- 1. Drop existing HNSW index
-- 2. Alter embedding column to vector(1536)
-- 3. Recreate HNSW index with new dimensions
-- 4. Update hybrid_search function to use vector(1536)

-- Step 1: Drop existing HNSW index (required before altering column type)
DROP INDEX IF EXISTS idx_document_embeddings_embedding;

-- Step 2: Alter the embedding column to use 1536 dimensions
-- WARNING: This will clear all existing embeddings. Re-ingestion required.
ALTER TABLE document_embeddings 
ALTER COLUMN embedding TYPE vector(1536);

-- Step 3: Recreate HNSW index using halfvec for 1536 dimensions
-- halfvec allows efficient indexing while maintaining good performance
-- Full precision is stored in the vector(1536) column, halfvec is only used for indexing
--
-- IMPORTANT: Query pattern to use this index:
-- SELECT * FROM document_embeddings
-- ORDER BY embedding::halfvec(1536) <=> '[query_vector]'::halfvec(1536)
-- LIMIT 10;
CREATE INDEX idx_document_embeddings_embedding ON document_embeddings 
USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 4: Update hybrid_search function to use vector(1536)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text text,
  p_tenant_id uuid,
  match_count int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  chunk_content text,
  metadata jsonb,
  created_at timestamptz,
  similarity_score float,
  text_rank_score float,
  combined_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT 
      de.id,
      de.document_id,
      de.chunk_index,
      de.chunk_content,
      de.metadata,
      de.created_at,
      -- Calculate cosine similarity (1 - cosine distance)
      1 - (de.embedding::halfvec(1536) <=> query_embedding::halfvec(1536)) AS similarity
    FROM document_embeddings de
    WHERE de.tenant_id = p_tenant_id
  ),
  text_search AS (
    SELECT 
      de.id,
      -- Calculate text rank score normalized to 0-1 range
      COALESCE(ts_rank(de.content_tsvector, websearch_to_tsquery('english', query_text)), 0) AS rank_score
    FROM document_embeddings de
    WHERE de.tenant_id = p_tenant_id
      AND de.content_tsvector @@ websearch_to_tsquery('english', query_text)
  ),
  combined AS (
    SELECT 
      vs.id,
      vs.document_id,
      vs.chunk_index,
      vs.chunk_content,
      vs.metadata,
      vs.created_at,
      vs.similarity,
      COALESCE(ts.rank_score, 0) AS text_rank,
      -- Combine scores: 70% vector similarity + 30% text rank
      (vs.similarity * 0.7) + (COALESCE(ts.rank_score, 0) * 0.3) AS combined
    FROM vector_search vs
    LEFT JOIN text_search ts ON vs.id = ts.id
  )
  SELECT 
    c.id,
    c.document_id,
    c.chunk_index,
    c.chunk_content,
    c.metadata,
    c.created_at,
    c.similarity::float AS similarity_score,
    c.text_rank::float AS text_rank_score,
    c.combined::float AS combined_score
  FROM combined c
  ORDER BY c.combined DESC
  LIMIT match_count;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION hybrid_search IS 'Hybrid search combining vector similarity (70%) and full-text search (30%) with tenant isolation. Uses Cohere Embed v4.0 (1536 dimensions)';
