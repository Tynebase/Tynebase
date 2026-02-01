-- Migration: Add document_export_enabled feature flag to tenant settings
-- Description: Enables tenant admins to control whether document export functionality is available
-- Default: true (enabled for all existing tenants)

-- Update existing tenants to have document_export_enabled set to true by default
UPDATE public.tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{features,document_export_enabled}',
  'true'::jsonb,
  true
)
WHERE settings->'features'->>'document_export_enabled' IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.settings IS 'Tenant configuration including branding, AI preferences, notifications, and feature flags (collaboration_enabled, ai_generation_enabled, rag_chat_enabled, document_export_enabled)';
