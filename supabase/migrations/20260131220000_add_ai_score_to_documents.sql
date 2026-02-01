-- Migration: Add AI score column to documents table
-- This stores the AI enhancement score (0-100) for each document

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100);

-- Add index for filtering/sorting by AI score
CREATE INDEX IF NOT EXISTS idx_documents_ai_score ON public.documents(ai_score) WHERE ai_score IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.documents.ai_score IS 'AI enhancement quality score (0-100) from document analysis';
