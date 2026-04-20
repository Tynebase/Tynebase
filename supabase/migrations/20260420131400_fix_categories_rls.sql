-- Migration: Fix Categories Update RLS Policy
-- Allow tenant admins to update categories, fixing reordering errors

DROP POLICY IF EXISTS "categories_update" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;

CREATE POLICY "categories_update" ON public.categories
FOR UPDATE TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    AND (
        author_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = (SELECT auth.uid()) 
            AND tenant_id = categories.tenant_id 
            AND role = 'admin'
        )
    )
)
WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    AND (
        author_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = (SELECT auth.uid()) 
            AND tenant_id = categories.tenant_id 
            AND role = 'admin'
        )
    )
);

-- Note: Depending on earlier migrations, maybe also fix DELETE
DROP POLICY IF EXISTS "categories_delete" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

CREATE POLICY "categories_delete" ON public.categories
FOR DELETE TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()) LIMIT 1)
    AND (
        author_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = (SELECT auth.uid()) 
            AND tenant_id = categories.tenant_id 
            AND role = 'admin'
        )
    )
);
