-- Migration: 20260409020000_remove_decimal_support_complete.sql
-- Description: Completely remove decimal support and revert to INTEGER credits

-- =====================================================
-- 1. Drop all existing credit functions to avoid conflicts
-- =====================================================
DROP FUNCTION IF EXISTS deduct_credits(UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS deduct_credits(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS deduct_credits(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_credit_balance(UUID, TEXT);

-- =====================================================
-- 2. Convert credit_pools table back to INTEGER
-- =====================================================
ALTER TABLE credit_pools
  DROP CONSTRAINT IF EXISTS credit_pools_total_credits_positive;
ALTER TABLE credit_pools
  DROP CONSTRAINT IF EXISTS credit_pools_used_credits_positive;
ALTER TABLE credit_pools
  DROP CONSTRAINT IF EXISTS credit_pools_used_not_exceed_total;

-- Convert NUMERIC back to INTEGER, rounding any decimal values
ALTER TABLE credit_pools
  ALTER COLUMN total_credits TYPE INTEGER USING ROUND(total_credits)::INTEGER;
ALTER TABLE credit_pools
  ALTER COLUMN used_credits  TYPE INTEGER USING ROUND(used_credits)::INTEGER;

-- Re-add constraints for INTEGER values
ALTER TABLE credit_pools
  ADD CONSTRAINT credit_pools_total_credits_positive
    CHECK (total_credits >= 0);
ALTER TABLE credit_pools
  ADD CONSTRAINT credit_pools_used_credits_positive
    CHECK (used_credits >= 0);
ALTER TABLE credit_pools
  ADD CONSTRAINT credit_pools_used_not_exceed_total
    CHECK (used_credits <= total_credits);

-- =====================================================
-- 3. Convert query_usage table back to INTEGER
-- =====================================================
ALTER TABLE query_usage
  DROP CONSTRAINT IF EXISTS query_usage_credits_positive;

ALTER TABLE query_usage
  ALTER COLUMN credits_charged TYPE INTEGER USING ROUND(credits_charged)::INTEGER;

ALTER TABLE query_usage
  ADD CONSTRAINT query_usage_credits_positive
    CHECK (credits_charged >= 0);

-- =====================================================
-- 4. Recreate deduct_credits function with INTEGER types
-- =====================================================
CREATE FUNCTION deduct_credits(
    p_tenant_id  UUID,
    p_credits    INTEGER,
    p_month_year TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM')
)
RETURNS TABLE(
    success           BOOLEAN,
    remaining_credits INTEGER,
    error_message     TEXT
) AS $$
DECLARE
    v_pool_id  UUID;
    v_total    INTEGER;
    v_used     INTEGER;
    v_available INTEGER;
BEGIN
    -- Lock the row for this tenant/month to prevent race conditions
    SELECT id, total_credits, used_credits
      INTO v_pool_id, v_total, v_used
      FROM credit_pools
     WHERE tenant_id  = p_tenant_id
       AND month_year = p_month_year
     FOR UPDATE;

    IF v_pool_id IS NULL THEN
        RETURN QUERY SELECT false, 0, 'No credit pool found for this month'::TEXT;
        RETURN;
    END IF;

    v_available := v_total - v_used;

    IF v_available < p_credits THEN
        RETURN QUERY SELECT false, v_available, 'Insufficient credits'::TEXT;
        RETURN;
    END IF;

    UPDATE credit_pools
       SET used_credits = used_credits + p_credits,
           updated_at   = NOW()
     WHERE id = v_pool_id;

    v_available := v_available - p_credits;
    RETURN QUERY SELECT true, v_available, 'Credits deducted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Recreate get_credit_balance function with INTEGER types
-- =====================================================
CREATE FUNCTION get_credit_balance(
    p_tenant_id  UUID,
    p_month_year TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM')
)
RETURNS TABLE(
    total_credits     INTEGER,
    used_credits      INTEGER,
    available_credits INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.total_credits,
        cp.used_credits,
        (cp.total_credits - cp.used_credits) AS available_credits
      FROM credit_pools cp
     WHERE cp.tenant_id  = p_tenant_id
       AND cp.month_year = p_month_year;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Update comments to reflect INTEGER usage
-- =====================================================
COMMENT ON COLUMN credit_pools.total_credits IS
  'Total credits allocated this month (INTEGER)';
COMMENT ON COLUMN credit_pools.used_credits IS
  'Credits consumed this month (INTEGER)';
COMMENT ON COLUMN query_usage.credits_charged IS
  'Credits charged for this operation (INTEGER)';
