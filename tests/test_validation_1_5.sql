-- Validation query for Task 1.5: Verify pgvector extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';
