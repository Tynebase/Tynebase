-- Validation Test for Task 2.11: Tenant Settings Update Endpoint
-- Tests: PATCH /api/tenants/:id

-- 1. Verify tenant exists with settings column
SELECT 
    id,
    subdomain,
    name,
    tier,
    settings,
    created_at,
    updated_at
FROM public.tenants
WHERE subdomain = 'test'
LIMIT 1;

-- 2. Verify test user has admin role
SELECT 
    u.id,
    u.email,
    u.role,
    u.tenant_id,
    u.is_super_admin,
    t.subdomain as tenant_subdomain
FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.email = 'test@test.com';

-- 3. Check current settings structure
SELECT 
    subdomain,
    settings,
    jsonb_typeof(settings) as settings_type,
    jsonb_pretty(settings) as settings_formatted
FROM public.tenants
WHERE subdomain = 'test';

-- Expected results:
-- 1. Test tenant should exist with UUID id
-- 2. Test user should have 'admin' role
-- 3. Settings should be JSONB type and contain valid structure
