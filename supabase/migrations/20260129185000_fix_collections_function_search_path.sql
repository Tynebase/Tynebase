-- Migration: Fix update_collections_updated_at function search_path
-- This function was missed in the previous search_path fix migration

CREATE OR REPLACE FUNCTION public.update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
