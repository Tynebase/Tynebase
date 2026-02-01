-- Migration: Fix dashboard stats errors (AI generation count + storage usage)

-- ============================================================================
-- 1) query_usage: add month_year for monthly dashboard stats
-- ============================================================================
ALTER TABLE public.query_usage
  ADD COLUMN IF NOT EXISTS month_year TEXT;

UPDATE public.query_usage
SET month_year = TO_CHAR(created_at, 'YYYY-MM')
WHERE month_year IS NULL;

ALTER TABLE public.query_usage
  ALTER COLUMN month_year SET DEFAULT TO_CHAR(NOW(), 'YYYY-MM');

CREATE INDEX IF NOT EXISTS idx_query_usage_month_year
  ON public.query_usage(month_year);

CREATE INDEX IF NOT EXISTS idx_query_usage_tenant_month_year
  ON public.query_usage(tenant_id, month_year);

-- ============================================================================
-- 2) get_tenant_storage_usage: avoid document_assets and use storage.objects
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_tenant_storage_usage(tenant_id_param UUID)
RETURNS TABLE (
  total_bytes BIGINT,
  document_count INTEGER,
  asset_count INTEGER
) AS $$
DECLARE
  asset_total INTEGER := 0;
  asset_bytes BIGINT := 0;
  doc_bytes BIGINT := 0;
BEGIN
  -- Get asset count and total bytes from storage.objects
  -- Size is stored in metadata->>'size' in Supabase storage
  SELECT 
    COALESCE(COUNT(*)::INTEGER, 0),
    COALESCE(SUM(
      CASE 
        WHEN metadata ? 'size' THEN (metadata->>'size')::BIGINT
        WHEN metadata->>'size' IS NOT NULL THEN (metadata->>'size')::BIGINT
        ELSE 0::BIGINT
      END
    ), 0::BIGINT)
  INTO asset_total, asset_bytes
  FROM storage.objects
  WHERE bucket_id IN ('tenant-uploads', 'tenant-documents', 'tenant-videos', 'tenant-assets')
    AND name LIKE format('tenant-%s/%%', tenant_id_param::text);

  -- Get document content bytes (content + yjs_state)
  SELECT COALESCE(
    (SELECT SUM(
      OCTET_LENGTH(COALESCE(content, '')) + 
      OCTET_LENGTH(COALESCE(yjs_state::text, ''))
    )::BIGINT
     FROM public.documents
     WHERE tenant_id = tenant_id_param),
    0::BIGINT
  ) INTO doc_bytes;

  RETURN QUERY
  SELECT
    (doc_bytes + asset_bytes) AS total_bytes,
    COALESCE(
      (SELECT COUNT(*)::INTEGER
       FROM public.documents
       WHERE tenant_id = tenant_id_param),
      0
    ) AS document_count,
    asset_total AS asset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.get_tenant_storage_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_storage_usage(UUID) TO service_role;
