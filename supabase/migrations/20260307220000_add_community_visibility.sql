-- Migration: Add 'community' to document visibility options
-- Updates the CHECK constraint to include 'community' visibility

-- First, drop the existing CHECK constraint
ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS documents_visibility_check;

-- Add the updated CHECK constraint with 'community' included
ALTER TABLE public.documents 
ADD CONSTRAINT documents_visibility_check 
CHECK (visibility IN ('private', 'team', 'public', 'community'));

-- Update comment to reflect all visibility options
COMMENT ON COLUMN public.documents.visibility IS 'Document visibility: private (author only), team (tenant members), public (anyone), community (shared on public hub)';
