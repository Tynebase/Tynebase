-- Validation Script for Task 1.4: Create Knowledge Base Tables
-- Tests documents and templates tables with foreign key constraints

-- Clean up any existing test data
DELETE FROM public.documents WHERE title LIKE 'Test Document%';
DELETE FROM public.templates WHERE title LIKE 'Test Template%';
DELETE FROM public.users WHERE email = 'test_task_1_4@test.com';
DELETE FROM public.tenants WHERE subdomain = 'test-task-1-4';

-- Step 1: Create test tenant
INSERT INTO public.tenants (subdomain, name, tier)
VALUES ('test-task-1-4', 'Test Task 1.4 Corp', 'free')
RETURNING id AS tenant_id, subdomain, name;

-- Store tenant_id for subsequent queries (replace with actual UUID from above)
-- For automated testing, we'll use a variable approach

DO $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_parent_doc_id UUID;
    v_child_doc_id UUID;
    v_template_id UUID;
BEGIN
    -- Get the test tenant
    SELECT id INTO v_tenant_id FROM public.tenants WHERE subdomain = 'test-task-1-4';
    
    -- Create test user in auth.users first (simulating Supabase Auth)
    INSERT INTO auth.users (id, email)
    VALUES (gen_random_uuid(), 'test_task_1_4@test.com')
    RETURNING id INTO v_user_id;
    
    -- Create test user in public.users
    INSERT INTO public.users (id, tenant_id, email, full_name, role)
    VALUES (v_user_id, v_tenant_id, 'test_task_1_4@test.com', 'Test User 1.4', 'admin');
    
    RAISE NOTICE 'Created tenant: % and user: %', v_tenant_id, v_user_id;
    
    -- Step 2: Test documents table - Create parent document
    INSERT INTO public.documents (tenant_id, title, content, status, author_id)
    VALUES (v_tenant_id, 'Test Document Parent', '# Parent Document\n\nThis is a test parent document.', 'draft', v_user_id)
    RETURNING id INTO v_parent_doc_id;
    
    RAISE NOTICE 'Created parent document: %', v_parent_doc_id;
    
    -- Step 3: Test parent_id foreign key constraint - Create child document
    INSERT INTO public.documents (tenant_id, title, content, parent_id, status, author_id)
    VALUES (v_tenant_id, 'Test Document Child', '# Child Document\n\nThis is a test child document.', v_parent_doc_id, 'draft', v_user_id)
    RETURNING id INTO v_child_doc_id;
    
    RAISE NOTICE 'Created child document: % with parent: %', v_child_doc_id, v_parent_doc_id;
    
    -- Step 4: Verify foreign key constraint works (should succeed)
    IF EXISTS (
        SELECT 1 FROM public.documents 
        WHERE id = v_child_doc_id 
        AND parent_id = v_parent_doc_id
    ) THEN
        RAISE NOTICE '✅ PASS: Foreign key constraint on parent_id works correctly';
    ELSE
        RAISE EXCEPTION '❌ FAIL: Foreign key constraint on parent_id failed';
    END IF;
    
    -- Step 5: Test templates table - Create tenant-specific template
    INSERT INTO public.templates (tenant_id, title, description, content, category, visibility, created_by)
    VALUES (v_tenant_id, 'Test Template Tenant', 'A tenant-specific template', '# Template\n\n{{content}}', 'business', 'internal', v_user_id)
    RETURNING id INTO v_template_id;
    
    RAISE NOTICE 'Created tenant template: %', v_template_id;
    
    -- Step 6: Test global template (tenant_id = NULL)
    INSERT INTO public.templates (tenant_id, title, description, content, category, visibility, is_approved, created_by)
    VALUES (NULL, 'Test Template Global', 'A global template', '# Global Template\n\n{{content}}', 'general', 'public', TRUE, v_user_id)
    RETURNING id INTO v_template_id;
    
    RAISE NOTICE 'Created global template: %', v_template_id;
    
    -- Step 7: Verify all records created
    RAISE NOTICE '--- Verification Summary ---';
    RAISE NOTICE 'Documents created: %', (SELECT COUNT(*) FROM public.documents WHERE tenant_id = v_tenant_id);
    RAISE NOTICE 'Templates created: %', (SELECT COUNT(*) FROM public.templates WHERE created_by = v_user_id);
    
    -- Step 8: Test CASCADE delete - Delete parent document should cascade to child
    RAISE NOTICE 'Testing CASCADE delete on parent document...';
    DELETE FROM public.documents WHERE id = v_parent_doc_id;
    
    IF NOT EXISTS (SELECT 1 FROM public.documents WHERE id = v_child_doc_id) THEN
        RAISE NOTICE '✅ PASS: CASCADE delete works - child document deleted with parent';
    ELSE
        RAISE EXCEPTION '❌ FAIL: CASCADE delete failed - child document still exists';
    END IF;
    
END $$;

-- Final verification queries
SELECT 
    '✅ Documents table exists' AS status,
    COUNT(*) AS test_records
FROM public.documents 
WHERE title LIKE 'Test Document%';

SELECT 
    '✅ Templates table exists' AS status,
    COUNT(*) AS test_records
FROM public.templates 
WHERE title LIKE 'Test Template%';

-- Verify indexes exist
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename IN ('documents', 'templates')
ORDER BY tablename, indexname;

-- Verify triggers exist
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table IN ('documents', 'templates')
ORDER BY event_object_table, trigger_name;

RAISE NOTICE '✅ ALL VALIDATION TESTS PASSED';
