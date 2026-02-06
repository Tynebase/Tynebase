-- Add sort_order column to tags table for drag-and-drop reordering
-- This enables users to organize tags in a custom order

-- Add the sort_order column
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_tags_sort_order ON public.tags(tenant_id, sort_order);

-- Initialize existing tags with default sort_order based on creation date
UPDATE public.tags 
SET sort_order = subquery.row_num
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) as row_num
    FROM public.tags
) subquery
WHERE public.tags.id = subquery.id AND public.tags.sort_order IS NULL;

-- Set default for future inserts (will be handled by application logic)
-- The app will calculate max sort_order + 1 for new tags

COMMENT ON COLUMN public.tags.sort_order IS 'Display order for drag-and-drop tag organization within a tenant';
