-- Add sort_order column to tags table for drag-and-drop reordering
-- This enables users to organize tags in a custom order

-- Add sort_order column with default value 0
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Create index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_tags_sort_order ON public.tags(tenant_id, sort_order);

-- Update existing tags to have sequential sort_order based on creation date
WITH ordered_tags AS (
  SELECT 
    id,
    tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) - 1 as new_sort_order
  FROM public.tags
)
UPDATE public.tags
SET sort_order = ordered_tags.new_sort_order
FROM ordered_tags
WHERE public.tags.id = ordered_tags.id;
