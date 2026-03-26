-- Migration: Chat Assignments
-- Purpose: Allow team members to assign documents and tasks to each other via team chat

-- ============================================================================
-- 1. Create chat_assignments table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chat_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.chat_channels(id) ON DELETE SET NULL,
    assigned_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Assignment type: 'document' or 'task'
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('document', 'task')),
    
    -- For document assignments
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    
    -- For task assignments
    title TEXT,
    description TEXT,
    
    -- Shared fields
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date DATE,
    
    -- Reference to the chat message where the assignment was made
    message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_assignments_tenant_id ON public.chat_assignments(tenant_id);
CREATE INDEX idx_chat_assignments_assigned_to ON public.chat_assignments(assigned_to);
CREATE INDEX idx_chat_assignments_assigned_by ON public.chat_assignments(assigned_by);
CREATE INDEX idx_chat_assignments_status ON public.chat_assignments(status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_chat_assignments_document_id ON public.chat_assignments(document_id) WHERE document_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.chat_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY chat_assignments_select_policy ON public.chat_assignments
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY chat_assignments_insert_policy ON public.chat_assignments
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY chat_assignments_update_policy ON public.chat_assignments
    FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY chat_assignments_delete_policy ON public.chat_assignments
    FOR DELETE USING (
        tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

-- Service role bypass
CREATE POLICY chat_assignments_service_role ON public.chat_assignments
    FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_chat_assignments_updated_at
    BEFORE UPDATE ON public.chat_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.chat_assignments IS 'Document and task assignments between team members, created via team chat';
