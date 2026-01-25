-- Validation SQL for Task 2.8: Signup Endpoint
-- Verifies: tenant creation, user creation, bucket creation, credit pool creation

-- Test tenant from signup: test-1769331033231@example.com
-- Replace with actual tenant_id from signup response: 59ac1414-5277-471c-b1d0-e0b3793b8e23

\echo '=== Task 2.8 Validation: Signup Endpoint ==='
\echo ''

-- 1. Verify tenant was created
\echo '1. Checking tenant creation...'
SELECT 
    id,
    subdomain,
    name,
    tier,
    storage_limit,
    created_at
FROM tenants
WHERE subdomain LIKE 'test-1769331033231'
ORDER BY created_at DESC
LIMIT 1;

\echo ''

-- 2. Verify user was created with admin role
\echo '2. Checking user creation...'
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.is_super_admin,
    u.status,
    u.tenant_id,
    t.subdomain as tenant_subdomain
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.email LIKE 'test-1769331033231@example.com'
ORDER BY u.created_at DESC
LIMIT 1;

\echo ''

-- 3. Verify auth.users entry exists
\echo '3. Checking auth.users entry...'
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users
WHERE email LIKE 'test-1769331033231@example.com'
ORDER BY created_at DESC
LIMIT 1;

\echo ''

-- 4. Verify credit pool was created
\echo '4. Checking credit pool creation...'
SELECT 
    cp.id,
    cp.tenant_id,
    cp.month_year,
    cp.total_credits,
    cp.used_credits,
    (cp.total_credits - cp.used_credits) as available_credits,
    t.subdomain as tenant_subdomain
FROM credit_pools cp
JOIN tenants t ON cp.tenant_id = t.id
WHERE t.subdomain LIKE 'test-1769331033231'
ORDER BY cp.created_at DESC
LIMIT 1;

\echo ''

-- 5. Check storage buckets (Note: Can't query buckets via SQL, check via Supabase dashboard)
\echo '5. Storage buckets verification:'
\echo '   Expected buckets:'
\echo '   - tenant-59ac1414-5277-471c-b1d0-e0b3793b8e23-uploads'
\echo '   - tenant-59ac1414-5277-471c-b1d0-e0b3793b8e23-documents'
\echo '   (Verify in Supabase Storage dashboard)'

\echo ''

-- 6. Verify transaction atomicity - all components should exist together
\echo '6. Verifying transaction atomicity...'
SELECT 
    COUNT(DISTINCT t.id) as tenant_count,
    COUNT(DISTINCT u.id) as user_count,
    COUNT(DISTINCT au.id) as auth_user_count,
    COUNT(DISTINCT cp.id) as credit_pool_count
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN auth.users au ON u.id = au.id
LEFT JOIN credit_pools cp ON t.id = cp.tenant_id
WHERE t.subdomain LIKE 'test-1769331033231';

\echo ''
\echo '=== Expected Results ==='
\echo 'tenant_count: 1'
\echo 'user_count: 1'
\echo 'auth_user_count: 1'
\echo 'credit_pool_count: 1'
\echo ''
\echo '✅ If all counts = 1, transaction was atomic and successful'
