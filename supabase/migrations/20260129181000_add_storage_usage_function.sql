-- Migration: Add get_tenant_storage_usage function
-- This function calculates storage usage for a tenant

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
             WHERE tenant_id = tenant_id_param),
            0::BIGINT
        ) AS total_bytes,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM public.documents 
             WHERE tenant_id = tenant_id_param),
            0
        ) AS document_count,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM public.document_assets 
             WHERE tenant_id = tenant_id_param),
            0
        ) AS asset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tenant_storage_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_storage_usage(UUID) TO service_role;
