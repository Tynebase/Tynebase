-- Migration: Add status column to tenants table
-- Phase 9: Super Admin Dashboard - Task 9.5
-- Enables tenant suspension functionality

-- Add status column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'suspended'));

-- Create index on status for filtering suspended tenants
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.status IS 'Tenant status: active or suspended. Suspended tenants cannot access the platform.';
