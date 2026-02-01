-- Migration: Fix overly permissive tenant INSERT RLS policy
-- Issue: service_role_insert_tenants allows any authenticated user to create tenants
-- Solution: Remove the overly permissive policy - service_role bypasses RLS anyway

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "service_role_insert_tenants" ON public.tenants;

-- Create a properly restricted insert policy for tenants
-- Only super admins can directly insert tenants via the API
-- Regular tenant creation happens through the backend with service_role (which bypasses RLS)
CREATE POLICY "super_admin_insert_tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_super_admin = TRUE
    )
);

-- Add comment for documentation
COMMENT ON POLICY "super_admin_insert_tenants" ON public.tenants IS 'Only super admins can insert tenants directly. Regular signup uses service_role which bypasses RLS.';
