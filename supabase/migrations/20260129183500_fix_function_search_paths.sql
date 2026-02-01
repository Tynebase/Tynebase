-- Migration: Fix function search_path security issue
-- All functions must have SET search_path = '' to prevent search path injection attacks
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- 1. update_updated_at_column (from identity.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 2. is_super_admin (from fix_rls_recursion.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- ============================================================================
-- 3. get_user_tenant_id (from fix_rls_recursion.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id FROM public.users
    WHERE users.id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- ============================================================================
-- 4. is_tenant_admin (from fix_rls_recursion.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_tenant_admin(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.tenant_id = tenant_uuid
    AND users.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- ============================================================================
-- 5. prevent_lineage_modification (from lineage.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_lineage_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Document lineage records are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 6. prevent_direct_lineage_modification (from fix_lineage_cascade.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_direct_lineage_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow cascade deletes (triggered by document deletion)
  -- Block direct deletes (when not triggered by cascade)
  IF TG_OP = 'DELETE' THEN
    -- Check if this is a cascade delete by verifying the document still exists
    -- If document doesn't exist, this is a cascade delete - allow it
    IF NOT EXISTS (SELECT 1 FROM public.documents WHERE id = OLD.document_id) THEN
      RETURN OLD; -- Allow cascade delete
    END IF;
    -- Document still exists, so this is a direct delete attempt - block it
    RAISE EXCEPTION 'Document lineage records are immutable and cannot be directly deleted';
  END IF;
  
  -- Block all updates
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Document lineage records are immutable and cannot be modified';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 7. update_user_consents_updated_at (from consents.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_consents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 8. deduct_credits (from credits.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.deduct_credits(
    p_tenant_id UUID,
    p_credits INTEGER,
    p_month_year TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM')
)
RETURNS TABLE(
    success BOOLEAN,
    remaining_credits INTEGER,
    message TEXT
) AS $$
DECLARE
    v_pool_id UUID;
    v_total INTEGER;
    v_used INTEGER;
    v_available INTEGER;
BEGIN
    -- Lock the row for update to prevent race conditions
    SELECT id, total_credits, used_credits
    INTO v_pool_id, v_total, v_used
    FROM public.credit_pools
    WHERE tenant_id = p_tenant_id 
      AND month_year = p_month_year
    FOR UPDATE;
    
    -- If no pool exists, return failure
    IF v_pool_id IS NULL THEN
        RETURN QUERY SELECT false, 0, 'No credit pool found for this month'::TEXT;
        RETURN;
    END IF;
    
    -- Calculate available credits
    v_available := v_total - v_used;
    
    -- Check if sufficient credits
    IF v_available < p_credits THEN
        RETURN QUERY SELECT false, v_available, 'Insufficient credits'::TEXT;
        RETURN;
    END IF;
    
    -- Deduct credits atomically
    UPDATE public.credit_pools
    SET used_credits = used_credits + p_credits,
        updated_at = NOW()
    WHERE id = v_pool_id;
    
    -- Return success with remaining credits
    v_available := v_available - p_credits;
    RETURN QUERY SELECT true, v_available, 'Credits deducted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 9. get_credit_balance (from credits.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_credit_balance(
    p_tenant_id UUID,
    p_month_year TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM')
)
RETURNS TABLE(
    total_credits INTEGER,
    used_credits INTEGER,
    available_credits INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.total_credits,
        cp.used_credits,
        (cp.total_credits - cp.used_credits) AS available_credits
    FROM public.credit_pools cp
    WHERE cp.tenant_id = p_tenant_id 
      AND cp.month_year = p_month_year;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 10. update_credit_pools_updated_at (from credits.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_credit_pools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 11. update_tags_updated_at (from create_tags.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 12. create_document_version (from document_versions.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_document_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
    last_version_time TIMESTAMPTZ;
BEGIN
    -- Only create version if content changed significantly
    IF OLD.content IS DISTINCT FROM NEW.content AND NEW.content IS NOT NULL THEN
        -- Check if enough time has passed since last version (minimum 5 minutes)
        SELECT MAX(created_at) INTO last_version_time
        FROM public.document_versions
        WHERE document_id = NEW.id;
        
        IF last_version_time IS NULL OR (NOW() - last_version_time) > INTERVAL '5 minutes' THEN
            -- Get next version number
            SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
            FROM public.document_versions
            WHERE document_id = NEW.id;
            
            -- Insert new version
            INSERT INTO public.document_versions (
                document_id,
                tenant_id,
                version_number,
                title,
                content,
                yjs_state,
                created_by
            ) VALUES (
                NEW.id,
                NEW.tenant_id,
                next_version,
                NEW.title,
                NEW.content,
                NEW.yjs_state,
                NEW.author_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 13. update_categories_updated_at (from create_categories_table.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 14. get_tenant_storage_usage (from add_storage_usage_function.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_tenant_storage_usage(tenant_id_param UUID)
RETURNS TABLE (
    total_bytes BIGINT,
    document_count INTEGER,
    asset_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(
            (SELECT SUM(OCTET_LENGTH(COALESCE(content, '')) + COALESCE(OCTET_LENGTH(yjs_state::text), 0))::BIGINT
             FROM public.documents 
             WHERE public.documents.tenant_id = tenant_id_param),
            0::BIGINT
        ) AS total_bytes,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM public.documents 
             WHERE public.documents.tenant_id = tenant_id_param),
            0
        ) AS document_count,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM public.document_assets 
             WHERE public.document_assets.tenant_id = tenant_id_param),
            0
        ) AS asset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant execute permission for get_tenant_storage_usage
GRANT EXECUTE ON FUNCTION public.get_tenant_storage_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_storage_usage(UUID) TO service_role;
