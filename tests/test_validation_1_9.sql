-- Validation Test for Task 1.9: User Consents Table
-- Tests: Table structure, default values, constraints, and trigger

-- Test 1: Verify table exists and has correct structure
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'user_consents'
ORDER BY ordinal_position;

-- Test 2: Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
    AND tablename = 'user_consents';

-- Test 3: Verify RLS policies exist
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'user_consents'
ORDER BY policyname;

-- Test 4: Verify foreign key constraint exists
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'user_consents';

-- Test 5: Verify trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
    AND event_object_table = 'user_consents'
ORDER BY trigger_name;

-- Test 6: Verify index exists
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'user_consents';

-- Test 7: Check if any existing users have consent records
SELECT COUNT(*) as consent_records_count
FROM public.user_consents;

-- Note: To test with actual data, you need a valid user_id from auth.users
-- Example (run only if you have a valid user):
-- INSERT INTO public.user_consents (user_id)
-- SELECT id FROM auth.users LIMIT 1
-- ON CONFLICT (user_id) DO NOTHING;
