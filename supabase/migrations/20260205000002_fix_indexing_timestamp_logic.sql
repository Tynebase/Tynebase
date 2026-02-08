-- Migration: Fix indexing status "Outdated" timestamp logic
-- Prevents updated_at from being auto-updated when only last_indexed_at changes
-- This fixes the issue where documents appear "outdated" immediately after indexing

-- Drop the existing trigger on documents table
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;

-- Create a new trigger function specifically for documents that skips updated_at update
-- when only last_indexed_at is being modified
CREATE OR REPLACE FUNCTION public.update_documents_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip updating updated_at if only last_indexed_at is being changed
    -- This prevents documents from appearing "outdated" immediately after indexing
    IF (
        NEW.last_indexed_at IS DISTINCT FROM OLD.last_indexed_at AND
        NEW.title IS NOT DISTINCT FROM OLD.title AND
        NEW.content IS NOT DISTINCT FROM OLD.content AND
        NEW.yjs_state IS NOT DISTINCT FROM OLD.yjs_state AND
        NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id AND
        NEW.is_public IS NOT DISTINCT FROM OLD.is_public AND
        NEW.status IS NOT DISTINCT FROM OLD.status AND
        NEW.published_at IS NOT DISTINCT FROM OLD.published_at
    ) THEN
        -- Only last_indexed_at changed, don't update updated_at
        RETURN NEW;
    END IF;
    
    -- Normal case: update updated_at to current time
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger with the new function
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_documents_updated_at_column();

-- Add comment explaining the behavior
COMMENT ON FUNCTION public.update_documents_updated_at_column() IS 
    'Updates updated_at on document changes, but skips when only last_indexed_at changes to prevent indexing status issues';
