-- Migration: 20260408000000_fix_credit_decimal_support.sql
-- Description: Change credit columns from INTEGER to NUMERIC(10,2) so that
--   fractional credit costs (e.g. DeepSeek = 0.2 credits/op) are tracked
--   accurately instead of being truncated to 0.
--
-- Affected objects:
--   credit_pools.total_credits    INTEGER → NUMERIC(10,2)
--   credit_pools.used_credits     INTEGER → NUMERIC(10,2)
--   query_usage.credits_charged   INTEGER → NUMERIC(10,2)
--   deduct_credits()  function    p_credits INTEGER → NUMERIC
--   get_credit_balance() function returns INTEGER → NUMERIC

-- =====================================================
-- 1. credit_pools — drop integer constraints, alter types, re-add
-- =====================================================
ALTER TABLE credit_pools
  DROP CONSTRAINT IF EXISTS credit_pools_total_credits_positive;
ALTER TABLE credit_pools
  DROP CONSTRAINT IF EXISTS credit_pools_used_credits_positive;
ALTER TABLE credit_pools
  DROP CONSTRAINT IF EXISTS credit_pools_used_not_exceed_total;

ALTER TABLE credit_pools
  ALTER COLUMN total_credits TYPE NUMERIC(10,2) USING total_credits::NUMERIC(10,2);
ALTER TABLE credit_pools
  ALTER COLUMN used_credits  TYPE NUMERIC(10,2) USING used_credits::NUMERIC(10,2);

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
-- 2. query_usage — drop integer constraint, alter type, re-add
-- =====================================================
ALTER TABLE query_usage
  DROP CONSTRAINT IF EXISTS query_usage_credits_positive;

ALTER TABLE query_usage
  ALTER COLUMN credits_charged TYPE NUMERIC(10,2) USING credits_charged::NUMERIC(10,2);

ALTER TABLE query_usage
  ADD CONSTRAINT query_usage_credits_positive
    CHECK (credits_charged >= 0);

-- =====================================================
-- 3. deduct_credits() — accept NUMERIC, return NUMERIC
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_credits(
    p_tenant_id  UUID,
    p_credits    NUMERIC,
    p_month_year TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM')
)
RETURNS TABLE(
    success           BOOLEAN,
    remaining_credits NUMERIC,
    message           TEXT
) AS $$
DECLARE
    v_pool_id  UUID;
    v_total    NUMERIC;
    v_used     NUMERIC;
    v_available NUMERIC;
BEGIN
    -- Lock the row for this tenant/month to prevent race conditions
    SELECT id, total_credits, used_credits
      INTO v_pool_id, v_total, v_used
      FROM credit_pools
     WHERE tenant_id  = p_tenant_id
       AND month_year = p_month_year
     FOR UPDATE;

    IF v_pool_id IS NULL THEN
        RETURN QUERY SELECT false, 0::NUMERIC, 'No credit pool found for this month'::TEXT;
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
-- 4. get_credit_balance() — return NUMERIC columns
-- =====================================================
DROP FUNCTION IF EXISTS get_credit_balance(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_credit_balance(
    p_tenant_id  UUID,
    p_month_year TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM')
)
RETURNS TABLE(
    total_credits     NUMERIC,
    used_credits      NUMERIC,
    available_credits NUMERIC
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
-- Comments
-- =====================================================
COMMENT ON COLUMN credit_pools.total_credits IS
  'Total credits allocated this month (NUMERIC supports fractional costs like 0.2 for DeepSeek)';
COMMENT ON COLUMN credit_pools.used_credits IS
  'Credits consumed this month (NUMERIC supports fractional values)';
COMMENT ON COLUMN query_usage.credits_charged IS
  'Exact credits charged for this operation (NUMERIC, e.g. 0.2 for DeepSeek)';
