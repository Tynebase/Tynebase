-- Migration: Rename "Uncategorized" to "Uncategorised" (British English)

-- Update all existing Uncategorized category rows
UPDATE public.categories
SET name = 'Uncategorised'
WHERE name = 'Uncategorized' AND is_system = TRUE;

-- Recreate the function with the new spelling
CREATE OR REPLACE FUNCTION get_or_create_uncategorized_category(p_tenant_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_category_id UUID;
BEGIN
    -- Try to find existing Uncategorised category
    SELECT id INTO v_category_id
    FROM public.categories
    WHERE tenant_id = p_tenant_id
    AND is_system = TRUE
    AND name = 'Uncategorised'
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
            'Uncategorised',
            'Default category for documents without a specific folder',
            '#6b7280',
            'folder',
            TRUE,
            p_user_id,
            -1
        )
        RETURNING id INTO v_category_id;
    END IF;
    
    RETURN v_category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_or_create_uncategorized_category IS 'Gets or creates the default Uncategorised category for a tenant';
