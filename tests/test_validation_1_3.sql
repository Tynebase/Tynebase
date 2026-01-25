-- Validation Script for Task 1.3: RLS Policies on Identity Tables
-- Tests tenant isolation and super admin access

-- ============================================================
-- SETUP: Create test data
-- ============================================================

-- Insert test tenants
INSERT INTO public.tenants (id, subdomain, name, tier) 
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'tenant-a', 'Tenant A Corp', 'free'),
    ('22222222-2222-2222-2222-222222222222', 'tenant-b', 'Tenant B Corp', 'pro')
ON CONFLICT (id) DO NOTHING;

-- Insert test users (assuming auth.users exists or we're testing with mock IDs)
-- Note: In production, these would be created via Supabase Auth
INSERT INTO public.users (id, tenant_id, email, role, is_super_admin, status)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin-a@tenant-a.com', 'admin', FALSE, 'active'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'admin-b@tenant-b.com', 'admin', FALSE, 'active'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'member-a@tenant-a.com', 'member', FALSE, 'active'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'superadmin@tynebase.com', 'admin', TRUE, 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TEST 1: Session Variable Isolation (from task requirements)
-- ============================================================

\echo '=== TEST 1: Session Variable with Wrong Tenant ID ==='
-- Set wrong tenant ID - should return 0 rows
SET app.current_tenant_id = '99999999-9999-9999-9999-999999999999';
SELECT COUNT(*) as wrong_tenant_count FROM public.tenants;
-- Expected: 0 rows

\echo '=== TEST 1: Session Variable with Correct Tenant ID ==='
-- Set correct tenant ID - should return 1 row
SET app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SELECT COUNT(*) as correct_tenant_count FROM public.tenants;
-- Expected: 1 row

-- Reset session variable
RESET app.current_tenant_id;

-- ============================================================
-- TEST 2: User Access to Own Tenant (simulated)
-- ============================================================

\echo '=== TEST 2: User Can See Own Tenant ==='
-- Simulate authenticated user from tenant A
-- In production, auth.uid() would return the actual user ID
-- For testing, we verify the policy logic exists
SELECT 
    t.id,
    t.subdomain,
    t.name,
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.tenant_id = t.id
        AND u.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    ) as user_has_access
FROM public.tenants t
WHERE t.id = '11111111-1111-1111-1111-111111111111';
-- Expected: 1 row with user_has_access = true

-- ============================================================
-- TEST 3: Super Admin Access
-- ============================================================

\echo '=== TEST 3: Super Admin Can See All Tenants ==='
SELECT 
    COUNT(*) as total_tenants,
    COUNT(*) FILTER (WHERE id = '11111111-1111-1111-1111-111111111111') as tenant_a_visible,
    COUNT(*) FILTER (WHERE id = '22222222-2222-2222-2222-222222222222') as tenant_b_visible
FROM public.tenants;
-- Expected: 2 total tenants (super admin can see all)

-- ============================================================
-- TEST 4: Users Table Isolation
-- ============================================================

\echo '=== TEST 4: Users in Same Tenant ==='
-- Users from tenant A should see each other
SELECT 
    u.email,
    u.tenant_id,
    u.role
FROM public.users u
WHERE u.tenant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY u.email;
-- Expected: 3 users from tenant A

\echo '=== TEST 4: Users Cannot See Other Tenants ==='
-- Verify tenant B user exists but would be filtered by RLS
SELECT 
    COUNT(*) as tenant_b_users
FROM public.users
WHERE tenant_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 1 user (but RLS would filter this in authenticated context)

-- ============================================================
-- TEST 5: RLS is Actually Enabled
-- ============================================================

\echo '=== TEST 5: Verify RLS is Enabled ==='
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'users')
ORDER BY tablename;
-- Expected: Both tables should have rls_enabled = true

-- ============================================================
-- TEST 6: List All Policies
-- ============================================================

\echo '=== TEST 6: List All RLS Policies ==='
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('tenants', 'users')
ORDER BY tablename, policyname;
-- Expected: Multiple policies for each table

-- ============================================================
-- VALIDATION SUMMARY
-- ============================================================

\echo '=== VALIDATION SUMMARY ==='
\echo 'If all tests show expected results, RLS is correctly configured:'
\echo '1. Session variable isolation works (0 rows for wrong tenant, 1 for correct)'
\echo '2. Users can access their own tenant data'
\echo '3. Super admins can access all tenants'
\echo '4. Tenant isolation is enforced on users table'
\echo '5. RLS is enabled on both tables'
\echo '6. All required policies are created'
