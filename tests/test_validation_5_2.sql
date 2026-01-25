-- =====================================================
-- Validation Script for Task 5.2: AI Generation Worker
-- =====================================================
-- Purpose: Verify worker components and database integration
-- Tests: documents table, lineage events, query_usage, job completion

-- Test 1: Verify documents table structure
SELECT 
    'Test 1: documents table structure' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'documents' 
            AND column_name IN ('id', 'tenant_id', 'title', 'content', 'status', 'author_id')
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 2: Verify document_lineage table with ai_generated event type
SELECT 
    'Test 2: ai_generated event type exists' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'lineage_event_type'
            AND e.enumlabel = 'ai_generated'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 3: Verify query_usage table exists
SELECT 
    'Test 3: query_usage table exists' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'query_usage'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 4: Verify query_usage has required columns
SELECT 
    'Test 4: query_usage required columns' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'query_usage' 
            AND column_name IN ('query_type', 'model', 'input_tokens', 'output_tokens', 'credits_used')
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 5: Check if any AI generation jobs have been processed
SELECT 
    'Test 5: AI generation jobs processed' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM job_queue 
            WHERE type = 'ai_generation'
        ) THEN '✅ PASS (jobs exist)'
        ELSE '⚠️  WARN (no jobs yet)'
    END AS result;

-- Test 6: Verify documents created by AI generation
SELECT 
    'Test 6: Documents from AI generation' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM documents d
            JOIN document_lineage dl ON d.id = dl.document_id
            WHERE dl.event_type = 'ai_generated'
        ) THEN '✅ PASS'
        ELSE '⚠️  WARN (no AI-generated docs yet)'
    END AS result;

-- Test 7: Verify RLS on documents table
SELECT 
    'Test 7: RLS enabled on documents' AS test_name,
    CASE 
        WHEN (
            SELECT relrowsecurity 
            FROM pg_class 
            WHERE relname = 'documents'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Test 8: Verify foreign key constraints
SELECT 
    'Test 8: Foreign key constraints exist' AS test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'documents' 
            AND constraint_type = 'FOREIGN KEY'
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS result;

-- Summary: Show recent AI generation activity
SELECT 
    '=== Recent AI Generation Jobs ===' AS section,
    j.id,
    j.type,
    j.status,
    j.created_at,
    j.completed_at,
    j.payload->>'model' AS model,
    j.result->>'document_id' AS document_id
FROM job_queue j
WHERE j.type = 'ai_generation'
ORDER BY j.created_at DESC
LIMIT 5;

-- Summary: Show AI-generated documents
SELECT 
    '=== AI-Generated Documents ===' AS section,
    d.id,
    d.title,
    d.status,
    d.created_at,
    dl.metadata->>'model' AS model,
    dl.metadata->>'provider' AS provider
FROM documents d
JOIN document_lineage dl ON d.id = dl.document_id
WHERE dl.event_type = 'ai_generated'
ORDER BY d.created_at DESC
LIMIT 5;

-- Summary: Show query usage for AI generation
SELECT 
    '=== Query Usage for AI Generation ===' AS section,
    qu.id,
    qu.query_type,
    qu.model,
    qu.input_tokens,
    qu.output_tokens,
    qu.credits_used,
    qu.created_at
FROM query_usage qu
WHERE qu.query_type = 'text_generation'
ORDER BY qu.created_at DESC
LIMIT 5;
