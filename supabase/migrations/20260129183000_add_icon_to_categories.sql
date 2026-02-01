-- Migration: Add icon field to categories table
-- Allows users to select an icon for each category

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'folder';

COMMENT ON COLUMN public.categories.icon IS 'Lucide icon name for the category';
