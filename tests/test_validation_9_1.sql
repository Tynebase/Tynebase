-- Validation Script for Task 9.1: Super Admin Guard Middleware
-- Verifies database schema supports is_super_admin flag

-- Test 1: Verify users table has is_super_admin column
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'is_super_admin';

-- Expected: One row showing is_super_admin column exists (boolean, default false)

-- Test 2: Check if any super admin users exist
SELECT 
  id,
  email,
  role,
  is_super_admin,
  tenant_id,
  status,
  created_at
FROM users
WHERE is_super_admin = true;

-- Expected: At least one super admin user (superadmin@tynebase.com)

-- Test 3: Check regular users (non-super-admin)
SELECT 
  id,
  email,
  role,
  is_super_admin,
  tenant_id,
  status
FROM users
WHERE is_super_admin = false
LIMIT 5;

-- Expected: Regular users with is_super_admin = false

-- Test 4: Count super admins vs regular users
SELECT 
  is_super_admin,
  COUNT(*) as user_count
FROM users
GROUP BY is_super_admin
ORDER BY is_super_admin DESC;

-- Expected: Shows distribution of super admins vs regular users

-- Test 5: Verify super admin can access any tenant (check tenant_id)
SELECT 
  u.email,
  u.is_super_admin,
  u.tenant_id,
  t.subdomain as user_tenant,
  COUNT(DISTINCT t2.id) as total_tenants
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
CROSS JOIN tenants t2
WHERE u.is_super_admin = true
GROUP BY u.email, u.is_super_admin, u.tenant_id, t.subdomain;

-- Expected: Super admin has a tenant_id but should be able to access all tenants via middleware
