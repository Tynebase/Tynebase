-- Migration: Add mark_document_indexed RPC function
-- Atomically sets last_indexed_at using DB clock to prevent false "outdated" status
-- Uses GREATEST(NOW(), updated_at) to guarantee last_indexed_at >= updated_at

CREATE OR REPLACE FUNCTION public.mark_document_indexed(doc_id UUID, t_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.documents
  SET last_indexed_at = GREATEST(NOW(), updated_at)
  WHERE id = doc_id AND tenant_id = t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to service_role (used by backend)
GRANT EXECUTE ON FUNCTION public.mark_document_indexed(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.mark_document_indexed(UUID, UUID) IS
  'Atomically marks a document as indexed. Uses GREATEST(NOW(), updated_at) to guarantee last_indexed_at >= updated_at, preventing false outdated status regardless of clock skew or trigger behavior.';
