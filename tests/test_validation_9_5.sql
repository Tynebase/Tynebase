-- Validation Script for Task 9.5: Tenant Suspend Endpoint
-- Verifies tenant status column and suspension functionality

-- 1. Verify tenants table has status column
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'tenants'
    AND column_name = 'status';

-- 2. Verify status check constraint exists
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conname = 'tenants_status_check'
    AND n.nspname = 'public';

-- 3. Verify index on status column exists
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'tenants'
    AND indexname = 'idx_tenants_status';

-- 4. Check all tenants have valid status (should be 'active' by default)
SELECT 
    status,
    COUNT(*) as count
FROM public.tenants
GROUP BY status;

-- 5. Verify test tenant exists and is active
SELECT 
    id,
    subdomain,
    name,
    status
FROM public.tenants
WHERE subdomain = 'test';
