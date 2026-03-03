-- Add custom_domain column to tenants table for white-label custom domain support
-- Pro and Enterprise tiers can set a custom domain (e.g., docs.acme.com) that serves
-- their branded public documents page.

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE DEFAULT NULL;

-- Add index for fast lookup by custom domain
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain
ON public.tenants (custom_domain)
WHERE custom_domain IS NOT NULL;

-- Add custom_domain_verified flag (domain ownership verified via DNS CNAME check)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS custom_domain_verified boolean DEFAULT false;

-- Expand branding settings: add logo_dark_url, favicon_url for white-label
-- These are stored in tenant settings JSONB, no schema change needed.

COMMENT ON COLUMN public.tenants.custom_domain IS 'Custom domain for white-label public docs (e.g., docs.acme.com). Must point CNAME to cname.vercel-dns.com.';
COMMENT ON COLUMN public.tenants.custom_domain_verified IS 'Whether the custom domain CNAME has been verified pointing to our infrastructure.';
