-- Migration: Add default Uncategorized category and update category deletion logic
-- This migration creates a protected "Uncategorized" category for each tenant
-- and sets up the infrastructure for proper category deletion with document migration

-- Add a flag to categories to mark system/default categories that cannot be deleted
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Add a comment explaining the column
COMMENT ON COLUMN public.categories.is_system IS 'System categories cannot be deleted (e.g., Uncategorized)';

-- Create an index for the is_system flag
CREATE INDEX IF NOT EXISTS idx_categories_is_system ON public.categories(is_system);

-- Update RLS policies to prevent deletion of system categories
-- First, drop and recreate the delete policy
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

-- New delete policy that prevents deletion of system categories
CREATE POLICY "categories_delete_policy" ON public.categories
    FOR DELETE
    USING (
        author_id = auth.uid() 
        AND is_system = FALSE
    );

-- Create a function to get or create the Uncategorized category for a tenant
CREATE OR REPLACE FUNCTION get_or_create_uncategorized_category(p_tenant_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_category_id UUID;
BEGIN
    -- Try to find existing Uncategorized category
    SELECT id INTO v_category_id
    FROM public.categories
    WHERE tenant_id = p_tenant_id
    AND is_system = TRUE
    AND name = 'Uncategorized'
    LIMIT 1;
    
    -- If not found, create it
    IF v_category_id IS NULL THEN
        INSERT INTO public.categories (
            tenant_id,
            name,
            description,
            color,
            icon,
            is_system,
            author_id,
            sort_order
        ) VALUES (
            p_tenant_id,
            'Uncategorized',
            'Default category for documents without a specific folder',
            '#6b7280',
            'folder',
            TRUE,
            p_user_id,
            -1  -- Always show first or last
        )
        RETURNING id INTO v_category_id;
    END IF;
    
    RETURN v_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Uncategorized categories for all existing tenants
DO $$
DECLARE
    r RECORD;
    v_first_user UUID;
BEGIN
    FOR r IN SELECT DISTINCT tenant_id FROM public.users LOOP
        -- Get first user from tenant to be the author
        SELECT id INTO v_first_user
        FROM public.users
        WHERE tenant_id = r.tenant_id
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF v_first_user IS NOT NULL THEN
            PERFORM get_or_create_uncategorized_category(r.tenant_id, v_first_user);
        END IF;
    END LOOP;
END $$;

-- Create a function to safely delete a category with document migration
CREATE OR REPLACE FUNCTION delete_category_with_migration(
    p_category_id UUID,
    p_target_category_id UUID DEFAULT NULL,  -- NULL means move to Uncategorized
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    deleted_category_id UUID,
    migrated_document_count INTEGER,
    target_category_id UUID
) AS $$
DECLARE
    v_tenant_id UUID;
    v_is_system BOOLEAN;
    v_uncategorized_id UUID;
    v_doc_count INTEGER;
    v_final_target_id UUID;
BEGIN
    -- Get category details
    SELECT c.tenant_id, c.is_system INTO v_tenant_id, v_is_system
    FROM public.categories c
    WHERE c.id = p_category_id;
    
    -- Check if category exists
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Category not found';
    END IF;
    
    -- Check if it's a system category
    IF v_is_system THEN
        RAISE EXCEPTION 'Cannot delete system categories';
    END IF;
    
    -- Verify user owns or has access to this category
    IF p_user_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.categories 
            WHERE id = p_category_id AND author_id = p_user_id
        ) THEN
            RAISE EXCEPTION 'Not authorized to delete this category';
        END IF;
    END IF;
    
    -- Determine target category
    IF p_target_category_id IS NOT NULL THEN
        -- Verify target exists in same tenant
        IF NOT EXISTS (
            SELECT 1 FROM public.categories 
            WHERE id = p_target_category_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'Target category not found';
        END IF;
        v_final_target_id := p_target_category_id;
    ELSE
        -- Get or create Uncategorized category
        v_final_target_id := get_or_create_uncategorized_category(v_tenant_id, 
            COALESCE(p_user_id, (SELECT author_id FROM public.categories WHERE id = p_category_id))
        );
    END IF;
    
    -- Count documents to be migrated
    SELECT COUNT(*) INTO v_doc_count
    FROM public.documents
    WHERE category_id = p_category_id;
    
    -- Move documents to target category
    UPDATE public.documents
    SET category_id = v_final_target_id
    WHERE category_id = p_category_id;
    
    -- Move subcategories to target category (or uncategorized)
    UPDATE public.categories
    SET parent_id = v_final_target_id
    WHERE parent_id = p_category_id;
    
    -- Delete the category
    DELETE FROM public.categories
    WHERE id = p_category_id;
    
    RETURN QUERY SELECT p_category_id, v_doc_count, v_final_target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON FUNCTION get_or_create_uncategorized_category IS 'Gets or creates the default Uncategorized category for a tenant';
COMMENT ON FUNCTION delete_category_with_migration IS 'Safely deletes a category and migrates documents to another category or Uncategorized';

