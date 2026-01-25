-- Simplified Validation for Task 1.3: RLS Policies
-- Run these queries in Supabase SQL Editor to verify RLS is working

-- Step 1: Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'users');
-- Expected: Both should show rls_enabled = true

-- Step 2: List all policies created
SELECT 
    tablename,
    policyname,
    cmd as operation,
    roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('tenants', 'users')
ORDER BY tablename, policyname;
-- Expected: Multiple policies for tenants and users tables

-- Step 3: Create test data for validation
INSERT INTO public.tenants (id, subdomain, name, tier) 
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'test-tenant-a', 'Test Tenant A', 'free'),
    ('22222222-2222-2222-2222-222222222222', 'test-tenant-b', 'Test Tenant B', 'pro')
ON CONFLICT (id) DO NOTHING;

-- Step 4: Test session variable isolation (from task requirements)
-- Set wrong tenant ID - should return 0 rows
SET app.current_tenant_id = '99999999-9999-9999-9999-999999999999';
SELECT COUNT(*) as wrong_tenant_count FROM public.tenants;

-- Set correct tenant ID - should return 1 row
SET app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SELECT COUNT(*) as correct_tenant_count FROM public.tenants;

-- Reset
RESET app.current_tenant_id;
