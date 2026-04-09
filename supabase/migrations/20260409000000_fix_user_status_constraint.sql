-- Migration: Fix status constraints to include 'archived' for both users and tenants tables
-- Both tables currently have constraints that don't include 'archived' but our code uses 'archived'
-- This migration updates both constraints to include 'archived' status

-- Fix users table constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users 
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'suspended', 'deleted', 'archived'));

-- Fix tenants table constraint  
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE public.tenants 
ADD CONSTRAINT tenants_status_check 
CHECK (status IN ('active', 'suspended', 'archived'));

-- Update comments to clarify the status values
COMMENT ON COLUMN public.users.status IS 'User status: active, suspended, deleted, or archived';
COMMENT ON COLUMN public.tenants.status IS 'Tenant status: active, suspended, or archived. Suspended tenants cannot access the platform.';
