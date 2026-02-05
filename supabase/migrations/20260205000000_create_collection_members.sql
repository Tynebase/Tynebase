-- ============================================================================
-- Collection Members Migration
-- ============================================================================
-- This migration creates a collection_members table to allow private
-- collections to be shared with specific users. Only the collection author
-- can invite/remove members from their private collections.
-- ============================================================================

-- Create collection_members table
CREATE TABLE IF NOT EXISTS public.collection_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Role in the collection (viewer can only view, editor can add/remove docs)
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
    
    -- Who invited this member
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- When they were added
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate memberships
    UNIQUE(collection_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_members_collection_id ON public.collection_members(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_members_user_id ON public.collection_members(user_id);

-- Enable RLS
ALTER TABLE public.collection_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for collection_members
-- ============================================================================

-- Users can view collection_members if they:
-- 1. Are the collection author
-- 2. Are a member of the collection
CREATE POLICY "collection_members_select_policy" ON public.collection_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND (
                c.author_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.collection_members cm
                    WHERE cm.collection_id = c.id
                    AND cm.user_id = auth.uid()
                )
            )
        )
    );

-- Only the collection author can add members
CREATE POLICY "collection_members_insert_policy" ON public.collection_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND c.author_id = auth.uid()
        )
        AND invited_by = auth.uid()
    );

-- Only the collection author can update member roles
CREATE POLICY "collection_members_update_policy" ON public.collection_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND c.author_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND c.author_id = auth.uid()
        )
    );

-- Only the collection author can remove members
CREATE POLICY "collection_members_delete_policy" ON public.collection_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND c.author_id = auth.uid()
        )
    );

-- ============================================================================
-- Update existing RLS policies for collections to include members
-- ============================================================================

-- Drop and recreate the select policy to include collection members
DROP POLICY IF EXISTS "collections_select_policy" ON public.collections;

CREATE POLICY "collections_select_policy" ON public.collections
    FOR SELECT
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND (
            visibility = 'public'
            OR visibility = 'team'
            OR author_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.collection_members cm
                WHERE cm.collection_id = id
                AND cm.user_id = auth.uid()
            )
        )
    );

-- Drop and recreate the select policy for collection_documents to include members
DROP POLICY IF EXISTS "collection_documents_select_policy" ON public.collection_documents;

CREATE POLICY "collection_documents_select_policy" ON public.collection_documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.id = collection_id
            AND c.tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
            AND (
                c.visibility = 'public'
                OR c.visibility = 'team'
                OR c.author_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.collection_members cm
                    WHERE cm.collection_id = c.id
                    AND cm.user_id = auth.uid()
                )
            )
        )
    );

-- ============================================================================
-- Create function to check if user is collection member with specific role
-- ============================================================================

CREATE OR REPLACE FUNCTION is_collection_member(
    p_collection_id UUID,
    p_user_id UUID,
    p_role VARCHAR(20) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_role IS NULL THEN
        -- Check if user is any type of member
        RETURN EXISTS (
            SELECT 1 FROM public.collection_members
            WHERE collection_id = p_collection_id
            AND user_id = p_user_id
        );
    ELSE
        -- Check if user has specific role
        RETURN EXISTS (
            SELECT 1 FROM public.collection_members
            WHERE collection_id = p_collection_id
            AND user_id = p_user_id
            AND role = p_role
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Add function to get collection members with user details
-- ============================================================================

CREATE OR REPLACE FUNCTION get_collection_members(p_collection_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    email VARCHAR,
    full_name TEXT,
    role VARCHAR(20),
    added_at TIMESTAMPTZ,
    invited_by UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id,
        cm.user_id,
        u.email,
        u.full_name,
        cm.role,
        cm.added_at,
        cm.invited_by
    FROM public.collection_members cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.collection_id = p_collection_id
    ORDER BY cm.added_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
