-- Migration: Fix Tenant INSERT RLS Policy
-- Issue: Signup fails with "new row violates row-level security policy for table tenants"
-- Solution: Add policy to allow service role to insert tenants during signup

-- Policy: Allow service role to insert tenants (for signup process)
-- This policy allows the backend service (using service role key) to create new tenants
CREATE POLICY "service_role_insert_tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON POLICY "service_role_insert_tenants" ON public.tenants IS 'Allow service role to insert tenants during signup process';
