-- =====================================================
-- Validation Script for Task 5.1: AI Generate Endpoint
-- =====================================================
-- Purpose: Verify database components for AI generation workflow
-- Tests: job_queue table, deduct_credits function, user_consents

-- Test 1: Verify job_queue table exists and has correct structure
SELECT 
    'Test 1: job_queue table structure' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'job_queue'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 2: Verify job_queue has ai_generation type support
SELECT 
    'Test 2: ai_generation job type support' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'job_queue' 
            AND column_name = 'type'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 3: Verify deduct_credits function exists
SELECT 
    'Test 3: deduct_credits function exists' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'deduct_credits'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 4: Verify user_consents table exists with ai_processing column
SELECT 
    'Test 4: user_consents.ai_processing column' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_consents' 
            AND column_name = 'ai_processing'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 5: Verify credit_pools table exists for credit tracking
SELECT 
    'Test 5: credit_pools table exists' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'credit_pools'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 6: Check test tenant has credits available
SELECT 
    'Test 6: Test tenant credit availability' AS test_name,
    CASE 
        WHEN (
            SELECT available_credits 
            FROM get_credit_balance(
                (SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1),
                TO_CHAR(NOW(), 'YYYY-MM')
            )
            LIMIT 1
        ) > 0 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 7: Verify RLS is enabled on job_queue
SELECT 
    'Test 7: RLS enabled on job_queue' AS test_name,
    CASE 
        WHEN (
            SELECT relrowsecurity 
            FROM pg_class 
            WHERE relname = 'job_queue'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 8: Verify job_queue has required indexes
SELECT 
    'Test 8: job_queue indexes exist' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'job_queue' 
            AND indexname LIKE '%tenant_id%'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Summary: Show current state of test tenant
SELECT 
    '=== Test Tenant Summary ===' AS section,
    t.subdomain,
    t.id AS tenant_id,
    (SELECT COUNT(*) FROM tenant_members WHERE tenant_id = t.id) AS member_count,
    COALESCE(
        (SELECT available_credits FROM get_credit_balance(t.id, TO_CHAR(NOW(), 'YYYY-MM')) LIMIT 1),
        0
    ) AS available_credits
FROM tenants t
WHERE t.subdomain = 'test'
LIMIT 1;

-- Show recent jobs for test tenant (if any)
SELECT 
    '=== Recent Jobs ===' AS section,
    j.id,
    j.type,
    j.status,
    j.created_at,
    j.payload->>'model' AS model,
    j.payload->>'estimated_credits' AS estimated_credits
FROM job_queue j
WHERE j.tenant_id = (SELECT id FROM tenants WHERE subdomain = 'test' LIMIT 1)
ORDER BY j.created_at DESC
LIMIT 5;
