-- Migration: Create Audit Tables
-- Purpose: Support content audit dashboard with activity logs, document reviews, and view tracking

-- ============================================================================
-- 1. Add view_count to documents table for tracking top performers
-- ============================================================================
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_documents_view_count ON public.documents(view_count DESC);

-- ============================================================================
-- 2. Create audit_logs table for tracking user activity
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- e.g., 'document.published', 'user.invited', 'auth.login'
    action_type TEXT NOT NULL, -- Category: 'document', 'user', 'auth', 'settings'
    target_type TEXT, -- What was affected: 'document', 'user', 'settings', null
    target_id UUID, -- ID of affected resource
    target_name TEXT, -- Human-readable name (e.g., document title, user email)
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_target ON public.audit_logs(target_type, target_id) WHERE target_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY audit_logs_select_policy ON public.audit_logs
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = TRUE
        )
    );

CREATE POLICY audit_logs_insert_policy ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_admin = TRUE
        )
    );

-- Service role bypass for audit_logs
CREATE POLICY audit_logs_service_role ON public.audit_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. Create document_reviews table for scheduling content reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.document_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    reason TEXT NOT NULL, -- e.g., 'Scheduled review', 'User feedback', 'Policy change'
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for document_reviews
CREATE INDEX idx_document_reviews_tenant_id ON public.document_reviews(tenant_id);
CREATE INDEX idx_document_reviews_document_id ON public.document_reviews(document_id);
CREATE INDEX idx_document_reviews_due_date ON public.document_reviews(due_date);
CREATE INDEX idx_document_reviews_status ON public.document_reviews(status) WHERE status = 'pending';
CREATE INDEX idx_document_reviews_priority ON public.document_reviews(priority);

-- Enable RLS
ALTER TABLE public.document_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_reviews
CREATE POLICY document_reviews_select_policy ON public.document_reviews
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY document_reviews_insert_policy ON public.document_reviews
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY document_reviews_update_policy ON public.document_reviews
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY document_reviews_delete_policy ON public.document_reviews
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Service role bypass for document_reviews
CREATE POLICY document_reviews_service_role ON public.document_reviews
    FOR ALL
    USING (auth.role() = 'service_role');

-- Updated_at trigger for document_reviews
CREATE TRIGGER update_document_reviews_updated_at
    BEFORE UPDATE ON public.document_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. Create function to increment document view count
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_document_view_count(doc_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.documents
    SET view_count = view_count + 1
    WHERE id = doc_id;
END;
$$;

-- ============================================================================
-- 5. Create function to get content health stats
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_content_health_stats(tenant_id_param UUID, days_threshold INTEGER DEFAULT 90)
RETURNS TABLE (
    total_documents BIGINT,
    published_documents BIGINT,
    draft_documents BIGINT,
    stale_documents BIGINT,
    needs_review BIGINT,
    excellent_health BIGINT,
    good_health BIGINT,
    review_needed BIGINT,
    poor_health BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    stale_threshold INTERVAL;
    review_threshold INTERVAL;
    good_threshold INTERVAL;
BEGIN
    stale_threshold := (days_threshold || ' days')::INTERVAL;
    review_threshold := ((days_threshold * 2 / 3) || ' days')::INTERVAL; -- 60 days for 90-day threshold
    good_threshold := ((days_threshold / 3) || ' days')::INTERVAL; -- 30 days for 90-day threshold

    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_documents,
        COUNT(*) FILTER (WHERE status = 'published')::BIGINT AS published_documents,
        COUNT(*) FILTER (WHERE status = 'draft')::BIGINT AS draft_documents,
        COUNT(*) FILTER (WHERE updated_at < NOW() - stale_threshold)::BIGINT AS stale_documents,
        (SELECT COUNT(*)::BIGINT FROM public.document_reviews dr WHERE dr.tenant_id = tenant_id_param AND dr.status = 'pending'),
        -- Excellent: Updated within good_threshold
        COUNT(*) FILTER (WHERE updated_at >= NOW() - good_threshold)::BIGINT AS excellent_health,
        -- Good: Updated between good_threshold and review_threshold
        COUNT(*) FILTER (WHERE updated_at < NOW() - good_threshold AND updated_at >= NOW() - review_threshold)::BIGINT AS good_health,
        -- Needs Review: Updated between review_threshold and stale_threshold
        COUNT(*) FILTER (WHERE updated_at < NOW() - review_threshold AND updated_at >= NOW() - stale_threshold)::BIGINT AS review_needed,
        -- Poor: Not updated for more than stale_threshold
        COUNT(*) FILTER (WHERE updated_at < NOW() - stale_threshold)::BIGINT AS poor_health
    FROM public.documents d
    WHERE d.tenant_id = tenant_id_param
    AND d.content NOT LIKE '__CATEGORY__%'; -- Exclude categories
END;
$$;

-- Comments for documentation
COMMENT ON TABLE public.audit_logs IS 'Tracks all user activity within a tenant for audit and compliance purposes';
COMMENT ON TABLE public.document_reviews IS 'Scheduled reviews for documents to maintain content quality';
COMMENT ON COLUMN public.documents.view_count IS 'Number of times this document has been viewed';
COMMENT ON FUNCTION public.get_content_health_stats IS 'Returns content health statistics for the audit dashboard';
