UPDATE public.users
SET role = 'editor'
WHERE role = 'member';

ALTER TABLE public.users
ALTER COLUMN role SET DEFAULT 'viewer';

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'editor', 'viewer'));

CREATE TABLE IF NOT EXISTS public.workspace_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    invited_by_name TEXT,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_tenant_id ON public.workspace_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_auth_user_id ON public.workspace_invites(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_status ON public.workspace_invites(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invites_pending_email ON public.workspace_invites(tenant_id, lower(email)) WHERE status = 'pending';

DROP TRIGGER IF EXISTS update_workspace_invites_updated_at ON public.workspace_invites;
CREATE TRIGGER update_workspace_invites_updated_at
    BEFORE UPDATE ON public.workspace_invites
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
