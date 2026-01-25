-- =====================================================
-- Database Performance Audit Script
-- Task 13.8: [Audit] Database Performance Review
-- Purpose: Check slow queries, missing indexes, large tables
-- =====================================================

-- =====================================================
-- SECTION 1: Table Statistics and Sizes
-- =====================================================
SELECT 
    '=== TABLE STATISTICS ===' AS section,
    NULL::text AS table_name,
    NULL::bigint AS row_count,
    NULL::text AS total_size,
    NULL::text AS table_size,
    NULL::text AS indexes_size;

SELECT 
    'Table Stats' AS section,
    schemaname || '.' || tablename AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- SECTION 2: Index Usage Statistics
-- =====================================================
SELECT 
    '=== INDEX USAGE STATISTICS ===' AS section,
    NULL::text AS table_name,
    NULL::text AS index_name,
    NULL::bigint AS index_scans,
    NULL::bigint AS tuples_read,
    NULL::bigint AS tuples_fetched,
    NULL::text AS index_size;

SELECT 
    'Index Usage' AS section,
    schemaname || '.' || tablename AS table_name,
    indexrelname AS index_name,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- =====================================================
-- SECTION 3: Missing Indexes on Foreign Keys
-- =====================================================
SELECT 
    '=== MISSING INDEXES ON FOREIGN KEYS ===' AS section,
    NULL::text AS table_name,
    NULL::text AS column_name,
    NULL::text AS constraint_name,
    NULL::text AS referenced_table;

SELECT 
    'Missing FK Index' AS section,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
            AND tablename = tc.table_name
            AND indexdef LIKE '%' || kcu.column_name || '%'
    )
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- SECTION 4: Unused Indexes (0 scans)
-- =====================================================
SELECT 
    '=== UNUSED INDEXES (0 SCANS) ===' AS section,
    NULL::text AS table_name,
    NULL::text AS index_name,
    NULL::text AS index_size,
    NULL::text AS index_definition;

SELECT 
    'Unused Index' AS section,
    schemaname || '.' || tablename AS table_name,
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    indexdef AS index_definition
FROM pg_stat_user_indexes
JOIN pg_indexes ON pg_indexes.indexname = pg_stat_user_indexes.indexrelname
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- =====================================================
-- SECTION 5: Table Bloat Analysis
-- =====================================================
SELECT 
    '=== TABLE BLOAT ANALYSIS ===' AS section,
    NULL::text AS table_name,
    NULL::bigint AS live_tuples,
    NULL::bigint AS dead_tuples,
    NULL::numeric AS dead_tuple_percent,
    NULL::timestamptz AS last_vacuum,
    NULL::timestamptz AS last_autovacuum;

SELECT 
    'Table Bloat' AS section,
    schemaname || '.' || tablename AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_percent,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_dead_tup > 0
ORDER BY n_dead_tup DESC;

-- =====================================================
-- SECTION 6: Sequential Scans on Large Tables
-- =====================================================
SELECT 
    '=== SEQUENTIAL SCANS ON LARGE TABLES ===' AS section,
    NULL::text AS table_name,
    NULL::bigint AS row_count,
    NULL::bigint AS seq_scans,
    NULL::bigint AS seq_tup_read,
    NULL::bigint AS idx_scans,
    NULL::numeric AS seq_scan_ratio;

SELECT 
    'Sequential Scans' AS section,
    schemaname || '.' || tablename AS table_name,
    n_live_tup AS row_count,
    seq_scan AS seq_scans,
    seq_tup_read AS seq_tup_read,
    idx_scan AS idx_scans,
    ROUND(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) AS seq_scan_ratio
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_live_tup > 1000
    AND seq_scan > 0
ORDER BY seq_scan DESC, n_live_tup DESC;

-- =====================================================
-- SECTION 7: Cache Hit Ratio (Should be > 99%)
-- =====================================================
SELECT 
    '=== CACHE HIT RATIO ===' AS section,
    NULL::text AS table_name,
    NULL::bigint AS heap_read,
    NULL::bigint AS heap_hit,
    NULL::numeric AS cache_hit_ratio;

SELECT 
    'Cache Hit Ratio' AS section,
    schemaname || '.' || tablename AS table_name,
    heap_blks_read AS heap_read,
    heap_blks_hit AS heap_hit,
    ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS cache_hit_ratio
FROM pg_statio_user_tables
WHERE schemaname = 'public'
    AND (heap_blks_hit + heap_blks_read) > 0
ORDER BY cache_hit_ratio ASC;

-- =====================================================
-- SECTION 8: Index Cache Hit Ratio
-- =====================================================
SELECT 
    '=== INDEX CACHE HIT RATIO ===' AS section,
    NULL::text AS index_name,
    NULL::bigint AS idx_blks_read,
    NULL::bigint AS idx_blks_hit,
    NULL::numeric AS cache_hit_ratio;

SELECT 
    'Index Cache Hit' AS section,
    schemaname || '.' || indexrelname AS index_name,
    idx_blks_read,
    idx_blks_hit,
    ROUND(100.0 * idx_blks_hit / NULLIF(idx_blks_hit + idx_blks_read, 0), 2) AS cache_hit_ratio
FROM pg_statio_user_indexes
WHERE schemaname = 'public'
    AND (idx_blks_hit + idx_blks_read) > 0
ORDER BY cache_hit_ratio ASC;

-- =====================================================
-- SECTION 9: Long Running Queries (if any active)
-- =====================================================
SELECT 
    '=== LONG RUNNING QUERIES ===' AS section,
    NULL::text AS query_duration,
    NULL::text AS state,
    NULL::text AS query_snippet;

SELECT 
    'Long Query' AS section,
    NOW() - query_start AS query_duration,
    state,
    LEFT(query, 100) AS query_snippet
FROM pg_stat_activity
WHERE state != 'idle'
    AND query NOT LIKE '%pg_stat_activity%'
    AND NOW() - query_start > INTERVAL '1 second'
ORDER BY query_start ASC;

-- =====================================================
-- SECTION 10: Database-Wide Statistics
-- =====================================================
SELECT 
    '=== DATABASE-WIDE STATISTICS ===' AS section,
    NULL::bigint AS total_connections,
    NULL::bigint AS active_connections,
    NULL::bigint AS idle_connections,
    NULL::bigint AS total_commits,
    NULL::bigint AS total_rollbacks;

SELECT 
    'DB Stats' AS section,
    (SELECT count(*) FROM pg_stat_activity) AS total_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') AS active_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') AS idle_connections,
    xact_commit AS total_commits,
    xact_rollback AS total_rollbacks
FROM pg_stat_database
WHERE datname = current_database();

-- =====================================================
-- SECTION 11: Check for Tables Without Primary Keys
-- =====================================================
SELECT 
    '=== TABLES WITHOUT PRIMARY KEYS ===' AS section,
    NULL::text AS table_name;

SELECT 
    'No PK' AS section,
    t.table_name
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints tc 
    ON t.table_name = tc.table_name 
    AND tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND tc.constraint_name IS NULL
ORDER BY t.table_name;

-- =====================================================
-- SECTION 12: RLS Policy Count per Table
-- =====================================================
SELECT 
    '=== RLS POLICIES PER TABLE ===' AS section,
    NULL::text AS table_name,
    NULL::boolean AS rls_enabled,
    NULL::bigint AS policy_count;

SELECT 
    'RLS Policies' AS section,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    COUNT(p.polname) AS policy_count
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- =====================================================
-- SECTION 13: Constraint Validation
-- =====================================================
SELECT 
    '=== CONSTRAINTS SUMMARY ===' AS section,
    NULL::text AS table_name,
    NULL::text AS constraint_type,
    NULL::bigint AS count;

SELECT 
    'Constraints' AS section,
    table_name,
    constraint_type,
    COUNT(*) AS count
FROM information_schema.table_constraints
WHERE table_schema = 'public'
GROUP BY table_name, constraint_type
ORDER BY table_name, constraint_type;

-- =====================================================
-- SECTION 14: Function Performance (if pg_stat_statements available)
-- =====================================================
SELECT 
    '=== CUSTOM FUNCTIONS ===' AS section,
    NULL::text AS function_name,
    NULL::text AS return_type,
    NULL::text AS language;

SELECT 
    'Functions' AS section,
    p.proname AS function_name,
    pg_get_function_result(p.oid) AS return_type,
    l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
ORDER BY p.proname;

-- =====================================================
-- END OF PERFORMANCE AUDIT
-- =====================================================
SELECT '=== AUDIT COMPLETE ===' AS section;
