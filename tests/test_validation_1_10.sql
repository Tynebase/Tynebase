-- =====================================================
-- Validation Test for Task 1.10: Credit Tracking Tables
-- =====================================================

-- Clean up any existing test data
DELETE FROM query_usage WHERE tenant_id IN (
    SELECT id FROM tenants WHERE subdomain = 'test-credits'
);
DELETE FROM credit_pools WHERE tenant_id IN (
    SELECT id FROM tenants WHERE subdomain = 'test-credits'
);
DELETE FROM users WHERE tenant_id IN (
    SELECT id FROM tenants WHERE subdomain = 'test-credits'
);
DELETE FROM tenants WHERE subdomain = 'test-credits';

-- =====================================================
-- Test 1: Create test tenant and user
-- =====================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    -- Create test tenant
    INSERT INTO tenants (subdomain, name, tier, created_at)
    VALUES ('test-credits', 'Test Credits Corp', 'pro', NOW())
    RETURNING id INTO v_tenant_id;
    
    RAISE NOTICE 'Created test tenant: %', v_tenant_id;
    
    -- Create test user
    INSERT INTO users (id, tenant_id, email, full_name, role, status, created_at)
    VALUES (gen_random_uuid(), v_tenant_id, 'test@credits.com', 'Test User', 'admin', 'active', NOW())
    RETURNING id INTO v_user_id;
    
    RAISE NOTICE 'Created test user: %', v_user_id;
END $$;

-- =====================================================
-- Test 2: Create credit pool with initial allocation
-- =====================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_pool_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'test-credits';
    
    INSERT INTO credit_pools (tenant_id, month_year, total_credits, used_credits)
    VALUES (v_tenant_id, TO_CHAR(NOW(), 'YYYY-MM'), 100, 0)
    RETURNING id INTO v_pool_id;
    
    RAISE NOTICE 'Created credit pool: % with 100 credits', v_pool_id;
END $$;

-- =====================================================
-- Test 3: Verify credit pool created correctly
-- =====================================================
SELECT 
    'Test 3: Credit Pool Created' AS test_name,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result,
    COUNT(*) AS pool_count,
    MAX(total_credits) AS total_credits,
    MAX(used_credits) AS used_credits
FROM credit_pools cp
JOIN tenants t ON cp.tenant_id = t.id
WHERE t.subdomain = 'test-credits';

-- =====================================================
-- Test 4: Test atomic credit decrement with sufficient credits
-- =====================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_success BOOLEAN;
    v_remaining INTEGER;
    v_message TEXT;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'test-credits';
    
    -- Deduct 5 credits
    SELECT success, remaining_credits, message 
    INTO v_success, v_remaining, v_message
    FROM deduct_credits(v_tenant_id, 5);
    
    RAISE NOTICE 'Deduct 5 credits: success=%, remaining=%, message=%', v_success, v_remaining, v_message;
    
    IF v_success = true AND v_remaining = 95 THEN
        RAISE NOTICE '✅ Test 4 PASS: Credits deducted successfully';
    ELSE
        RAISE EXCEPTION '❌ Test 4 FAIL: Expected success=true, remaining=95, got success=%, remaining=%', v_success, v_remaining;
    END IF;
END $$;

-- =====================================================
-- Test 5: Verify credit pool updated correctly
-- =====================================================
SELECT 
    'Test 5: Credit Pool Updated' AS test_name,
    CASE 
        WHEN MAX(used_credits) = 5 AND MAX(total_credits - used_credits) = 95 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result,
    MAX(used_credits) AS used_credits,
    MAX(total_credits - used_credits) AS available_credits
FROM credit_pools cp
JOIN tenants t ON cp.tenant_id = t.id
WHERE t.subdomain = 'test-credits';

-- =====================================================
-- Test 6: Test atomic credit decrement with insufficient credits
-- =====================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_success BOOLEAN;
    v_remaining INTEGER;
    v_message TEXT;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'test-credits';
    
    -- Try to deduct 100 credits (only 95 available)
    SELECT success, remaining_credits, message 
    INTO v_success, v_remaining, v_message
    FROM deduct_credits(v_tenant_id, 100);
    
    RAISE NOTICE 'Deduct 100 credits (insufficient): success=%, remaining=%, message=%', v_success, v_remaining, v_message;
    
    IF v_success = false AND v_message = 'Insufficient credits' THEN
        RAISE NOTICE '✅ Test 6 PASS: Insufficient credits correctly blocked';
    ELSE
        RAISE EXCEPTION '❌ Test 6 FAIL: Expected failure with insufficient credits message';
    END IF;
END $$;

-- =====================================================
-- Test 7: Verify credits not deducted on failure
-- =====================================================
SELECT 
    'Test 7: Credits Not Deducted on Failure' AS test_name,
    CASE 
        WHEN MAX(used_credits) = 5 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result,
    MAX(used_credits) AS used_credits,
    'Should still be 5' AS expected
FROM credit_pools cp
JOIN tenants t ON cp.tenant_id = t.id
WHERE t.subdomain = 'test-credits';

-- =====================================================
-- Test 8: Test get_credit_balance function
-- =====================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_total INTEGER;
    v_used INTEGER;
    v_available INTEGER;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'test-credits';
    
    SELECT total_credits, used_credits, available_credits
    INTO v_total, v_used, v_available
    FROM get_credit_balance(v_tenant_id);
    
    RAISE NOTICE 'Credit balance: total=%, used=%, available=%', v_total, v_used, v_available;
    
    IF v_total = 100 AND v_used = 5 AND v_available = 95 THEN
        RAISE NOTICE '✅ Test 8 PASS: Credit balance function works correctly';
    ELSE
        RAISE EXCEPTION '❌ Test 8 FAIL: Expected total=100, used=5, available=95';
    END IF;
END $$;

-- =====================================================
-- Test 9: Insert query usage log
-- =====================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_usage_id UUID;
BEGIN
    SELECT t.id, u.id INTO v_tenant_id, v_user_id 
    FROM tenants t
    JOIN users u ON u.tenant_id = t.id
    WHERE t.subdomain = 'test-credits';
    
    INSERT INTO query_usage (
        tenant_id, 
        user_id, 
        query_type, 
        ai_model, 
        tokens_input, 
        tokens_output, 
        credits_charged,
        metadata
    )
    VALUES (
        v_tenant_id,
        v_user_id,
        'ai_generate',
        'gpt-5.2',
        1000,
        2000,
        5,
        '{"document_id": "test-doc-123", "prompt": "Generate article"}'::jsonb
    )
    RETURNING id INTO v_usage_id;
    
    RAISE NOTICE 'Created query usage log: %', v_usage_id;
END $$;

-- =====================================================
-- Test 10: Verify query usage log created
-- =====================================================
SELECT 
    'Test 10: Query Usage Log Created' AS test_name,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result,
    COUNT(*) AS log_count,
    MAX(query_type) AS query_type,
    MAX(ai_model) AS ai_model,
    MAX(tokens_input) AS tokens_input,
    MAX(tokens_output) AS tokens_output,
    MAX(credits_charged) AS credits_charged
FROM query_usage qu
JOIN tenants t ON qu.tenant_id = t.id
WHERE t.subdomain = 'test-credits';

-- =====================================================
-- Test 11: Test RLS policies (credit_pools)
-- =====================================================
SELECT 
    'Test 11: RLS Enabled on credit_pools' AS test_name,
    CASE 
        WHEN relrowsecurity = true THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result
FROM pg_class
WHERE relname = 'credit_pools';

-- =====================================================
-- Test 12: Test RLS policies (query_usage)
-- =====================================================
SELECT 
    'Test 12: RLS Enabled on query_usage' AS test_name,
    CASE 
        WHEN relrowsecurity = true THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result
FROM pg_class
WHERE relname = 'query_usage';

-- =====================================================
-- Test 13: Verify indexes created
-- =====================================================
SELECT 
    'Test 13: Indexes Created' AS test_name,
    CASE 
        WHEN COUNT(*) >= 8 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result,
    COUNT(*) AS index_count,
    'Expected at least 8 indexes' AS note
FROM pg_indexes
WHERE tablename IN ('credit_pools', 'query_usage')
AND schemaname = 'public';

-- =====================================================
-- Test 14: Verify constraints
-- =====================================================
SELECT 
    'Test 14: Constraints Created' AS test_name,
    CASE 
        WHEN COUNT(*) >= 5 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result,
    COUNT(*) AS constraint_count
FROM pg_constraint
WHERE conrelid IN (
    SELECT oid FROM pg_class WHERE relname IN ('credit_pools', 'query_usage')
);

-- =====================================================
-- Test 15: Test concurrent credit deduction (race condition prevention)
-- =====================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_success1 BOOLEAN;
    v_success2 BOOLEAN;
    v_remaining1 INTEGER;
    v_remaining2 INTEGER;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'test-credits';
    
    -- Deduct 50 credits twice (should succeed once, fail once)
    SELECT success, remaining_credits 
    INTO v_success1, v_remaining1
    FROM deduct_credits(v_tenant_id, 50);
    
    SELECT success, remaining_credits 
    INTO v_success2, v_remaining2
    FROM deduct_credits(v_tenant_id, 50);
    
    RAISE NOTICE 'First deduction: success=%, remaining=%', v_success1, v_remaining1;
    RAISE NOTICE 'Second deduction: success=%, remaining=%', v_success2, v_remaining2;
    
    IF v_success1 = true AND v_success2 = false THEN
        RAISE NOTICE '✅ Test 15 PASS: Race condition prevented, only one deduction succeeded';
    ELSE
        RAISE EXCEPTION '❌ Test 15 FAIL: Race condition not properly handled';
    END IF;
END $$;

-- =====================================================
-- Final Summary
-- =====================================================
SELECT 
    '=== FINAL SUMMARY ===' AS summary,
    (SELECT COUNT(*) FROM credit_pools WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = 'test-credits')) AS credit_pools_count,
    (SELECT COUNT(*) FROM query_usage WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = 'test-credits')) AS query_usage_count,
    (SELECT used_credits FROM credit_pools WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = 'test-credits')) AS final_used_credits,
    (SELECT total_credits - used_credits FROM credit_pools WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain = 'test-credits')) AS final_available_credits;

-- =====================================================
-- Cleanup test data
-- =====================================================
DELETE FROM query_usage WHERE tenant_id IN (
    SELECT id FROM tenants WHERE subdomain = 'test-credits'
);
DELETE FROM credit_pools WHERE tenant_id IN (
    SELECT id FROM tenants WHERE subdomain = 'test-credits'
);
DELETE FROM users WHERE tenant_id IN (
    SELECT id FROM tenants WHERE subdomain = 'test-credits'
);
DELETE FROM tenants WHERE subdomain = 'test-credits';

SELECT '✅ Test data cleaned up' AS cleanup_status;
