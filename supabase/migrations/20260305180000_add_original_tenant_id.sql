-- Migration: Add original_tenant_id to track user's home workspace
-- When a user is invited to another workspace, we store their original workspace
-- so they can return to it when they leave/are removed

-- Add original_tenant_id column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS original_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_users_original_tenant_id ON public.users(original_tenant_id);

-- Add comment for documentation
COMMENT ON COLUMN public.users.original_tenant_id IS 'The user''s original/home workspace. When invited elsewhere, this stores where they came from so they can return on leave.';
