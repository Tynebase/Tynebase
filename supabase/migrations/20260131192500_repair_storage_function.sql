-- Repair migration: Ensure get_tenant_storage_usage function exists on remote
-- This fixes the 0.0/5GB storage display issue

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
