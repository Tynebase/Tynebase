-- Migration: Add visibility column to documents table
-- Replaces is_public boolean with proper visibility enum: 'private', 'team', 'public'

-- Add visibility column with default 'team'
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team' 
CHECK (visibility IN ('private', 'team', 'public'));

-- Migrate existing data: is_public=true -> 'public', is_public=false -> 'private'
UPDATE public.documents 
SET visibility = CASE 
    WHEN is_public = TRUE THEN 'public'
    ELSE 'team'  -- Default existing private docs to team
END;

-- Create index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON public.documents(visibility);

-- Add comment
COMMENT ON COLUMN public.documents.visibility IS 'Document visibility: private (author only), team (tenant members), public (anyone - future feature)';
