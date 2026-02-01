-- Migration: Add model_used column to query_usage table
-- Purpose: Support legacy code that references model_used instead of ai_model
-- Date: 2026-01-30

-- Add model_used column as alias for ai_model
ALTER TABLE query_usage ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Create index for model_used queries
CREATE INDEX IF NOT EXISTS idx_query_usage_model_used ON query_usage(model_used);

-- Add comment for documentation
COMMENT ON COLUMN query_usage.model_used IS 'Model identifier used for the query (legacy column, prefer ai_model)';
