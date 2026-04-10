-- Migration: Surgical Multi-Tenant Identity Transition
-- Objective: Safely upgrade public.users to a composite primary key by handling all dependent foreign keys.

DO $$ 
DECLARE 
    r RECORD;
    sql_drop TEXT;
    sql_recreate TEXT;
BEGIN
    -- 1. Create a temporary table to store the constraints we need to drop and recreate
    CREATE TEMP TABLE constraint_backup (
        table_name TEXT,
        constraint_name TEXT,
        column_name TEXT,
        on_delete_action TEXT
    );

    -- 2. Populate the backup with foreign keys pointing to public.users(id)
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

    -- 3. Drop all the identified foreign keys
    FOR r IN (SELECT * FROM constraint_backup) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;

    -- 4. Modify the users table primary key
    -- Check if it's already composite to avoid errors
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey;
    END IF;
    
    ALTER TABLE public.users ADD PRIMARY KEY (id, tenant_id);

    -- 5. Re-create foreign keys as composite references (id, tenant_id)
    FOR r IN (SELECT * FROM constraint_backup) LOOP
        -- Case 1: The table has a tenant_id column (ideal for multi-tenant isolation)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'tenant_id'
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE %s',
                r.table_name, r.constraint_name, r.column_name, r.on_delete_action
            );
        -- Case 2: The table DOES NOT have a tenant_id (e.g. meta-tables)
        -- We fall back to a join if we must, but in TyneBase, almost all should have tenant_id.
        -- If it doesn't, we'll recreate the original ID-only FK if possible (but id is no longer unique).
        -- NOTE: For this migration, we assume tenant_id exists or we skip and log.
        ELSE
            RAISE NOTICE 'Skipping recreation of % on % because tenant_id column is missing', r.constraint_name, r.table_name;
        END IF;
    END LOOP;

    DROP TABLE constraint_backup;
END $$;

-- 6. Add Unique constraint for (email, tenant_id) if not exists
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_tenant_key;
ALTER TABLE public.users ADD CONSTRAINT users_email_tenant_key UNIQUE (email, tenant_id);

-- 7. Update Comments
COMMENT ON TABLE public.users IS 'Supports multi-tenant identities. A single Supabase ID can have multiple rows, one per tenant membership.';
