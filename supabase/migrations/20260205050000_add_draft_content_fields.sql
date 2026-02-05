-- Migration: Add draft content fields for publish/draft workflow
-- Adds fields to support standard CMS-style draft/published workflow

-- Add draft content fields to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS draft_content TEXT,
ADD COLUMN IF NOT EXISTS draft_title TEXT,
ADD COLUMN IF NOT EXISTS has_draft BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMPTZ;

-- Create index for efficient draft queries
CREATE INDEX IF NOT EXISTS idx_documents_has_draft ON public.documents(has_draft) WHERE has_draft = TRUE;

-- Update the auto-versioning trigger to handle draft saves
-- We want to create versions for both draft and published content changes

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS document_auto_version ON public.documents;

-- Create updated version function that tracks both draft and published changes
CREATE OR REPLACE FUNCTION public.create_document_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
    last_version_time TIMESTAMPTZ;
    should_create_version BOOLEAN := FALSE;
BEGIN
    -- Create version for significant content changes (published content)
    IF OLD.content IS DISTINCT FROM NEW.content AND NEW.content IS NOT NULL THEN
        should_create_version := TRUE;
    END IF;
    
    -- Also create version when draft content changes and has_draft becomes true
    IF OLD.draft_content IS DISTINCT FROM NEW.draft_content AND NEW.draft_content IS NOT NULL THEN
        should_create_version := TRUE;
    END IF;
    
    IF should_create_version THEN
        -- Check if enough time has passed since last version (minimum 5 minutes)
        SELECT MAX(created_at) INTO last_version_time
        FROM public.document_versions
        WHERE document_id = NEW.id;
        
        IF last_version_time IS NULL OR (NOW() - last_version_time) > INTERVAL '5 minutes' THEN
            -- Get next version number
            SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
            FROM public.document_versions
            WHERE document_id = NEW.id;
            
            -- Insert new version with the current content (published or draft)
            INSERT INTO public.document_versions (
                document_id,
                tenant_id,
                version_number,
                title,
                content,
                yjs_state,
                created_by
            ) VALUES (
                NEW.id,
                NEW.tenant_id,
                next_version,
                NEW.title,
                NEW.content,
                NEW.yjs_state,
                NEW.author_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER document_auto_version
    AFTER UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.create_document_version();

-- Add comments for documentation
COMMENT ON COLUMN public.documents.draft_content IS 'Draft markdown content (only populated when published doc has unsaved changes)';
COMMENT ON COLUMN public.documents.draft_title IS 'Draft title (only populated when published doc has unsaved title changes)';
COMMENT ON COLUMN public.documents.has_draft IS 'True when published document has unsaved draft changes';
COMMENT ON COLUMN public.documents.draft_updated_at IS 'Timestamp of last draft save';

-- Update existing published documents to ensure proper state
UPDATE public.documents 
SET has_draft = FALSE 
WHERE status = 'published' AND has_draft IS NULL;

UPDATE public.documents 
SET has_draft = TRUE 
WHERE status = 'draft' AND has_draft IS NULL;
