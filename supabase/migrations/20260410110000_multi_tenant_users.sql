-- Migration: Surgical Multi-Tenant Identity Transition (Final Hardened version)
-- Objective: Upgrade public.users to a composite primary key and REPAIR mis-tenant-linked data with per-record fallbacks.

DO $$ 
DECLARE 
    r RECORD;
    global_fallback_id UUID;
    fallback_email TEXT;
    fallback_name TEXT;
BEGIN
    -- 1. Identify a Global Fallback User (the first Super Admin)
    SELECT id, email, full_name INTO global_fallback_id, fallback_email, fallback_name 
    FROM public.users WHERE is_super_admin = TRUE ORDER BY created_at ASC LIMIT 1;
    
    -- Fallback to the first user if no super admin
    IF global_fallback_id IS NULL THEN
        SELECT id, email, full_name INTO global_fallback_id, fallback_email, fallback_name 
        FROM public.users ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- 2. Create a temporary table to store the constraints we need to drop and recreate
    CREATE TEMP TABLE constraint_backup (
        table_name TEXT,
        constraint_name TEXT,
        column_name TEXT,
        on_delete_action TEXT
    );

    -- 3. Populate backup with foreign keys pointing to public.users(id)
    INSERT INTO constraint_backup (table_name, constraint_name, column_name, on_delete_action)
    SELECT 
        tc.table_name, 
        tc.constraint_name, 
        kcu.column_name,
        rc.delete_rule
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
          AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
      AND tc.table_schema = 'public';

    -- 4. Drop identified foreign keys
    FOR r IN (SELECT * FROM constraint_backup) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;

    -- 5. REPAIR ORPHANED/MISALIGNED DATA
    FOR r IN (SELECT * FROM constraint_backup) LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'tenant_id') THEN
            
            -- ENSURE REPLACEMENT PROFILE EXISTS IN EACH TENANT THAT HAS ORPHANS
            -- We create a shadow membership for the fallback user in any tenant that needs data repair.
            EXECUTE format(
                'INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
                 SELECT DISTINCT %L::uuid, tenant_id, %L, %L, ''community_contributor'', ''active''
                 FROM public.%I child
                 WHERE NOT EXISTS (SELECT 1 FROM public.users parent WHERE parent.id = %L::uuid AND parent.tenant_id = child.tenant_id)
                 AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = child.%I AND p.tenant_id = child.tenant_id)',
                global_fallback_id, fallback_email, fallback_name, r.table_name, global_fallback_id, r.column_name
            );

            -- Perform the repair update
            EXECUTE format(
                'UPDATE public.%I child
                 SET %I = COALESCE(
                    (SELECT id FROM public.users parent 
                     WHERE parent.tenant_id = child.tenant_id 
                     ORDER BY parent.created_at ASC LIMIT 1),
                    %L::uuid
                 )
                 WHERE NOT EXISTS (
                    SELECT 1 FROM public.users p 
                    WHERE p.id = child.%I AND p.tenant_id = child.tenant_id
                 )',
                r.table_name, r.column_name, global_fallback_id, r.column_name
            );
            
            RAISE NOTICE 'Repaired mis-tenant-linked records in table %', r.table_name;
        END IF;
    END LOOP;

    -- 6. Modify the users table primary key
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'users' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey;
    END IF;
    
    ALTER TABLE public.users ADD PRIMARY KEY (id, tenant_id);

    -- 7. Re-create foreign keys as composite references
    FOR r IN (SELECT * FROM constraint_backup) LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'tenant_id') THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE %s',
                r.table_name, r.constraint_name, r.column_name, r.on_delete_action
            );
        ELSE
            RAISE NOTICE 'Skipping recreation of % on % because tenant_id column is missing', r.constraint_name, r.table_name;
        END IF;
    END LOOP;

    DROP TABLE constraint_backup;
END $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_tenant_key;
ALTER TABLE public.users ADD CONSTRAINT users_email_tenant_key UNIQUE (email, tenant_id);

COMMENT ON TABLE public.users IS 'Supports multi-tenant identities. A single Supabase ID can have multiple rows, one per tenant membership.';
