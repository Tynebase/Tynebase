-- Insert test tenant for middleware validation
-- Task 2.3: Create Subdomain Resolution Middleware

INSERT INTO public.tenants (subdomain, name, tier, settings)
VALUES ('test', 'Test Corporation', 'free', '{"ai_provider": "openai"}'::jsonb)
ON CONFLICT (subdomain) DO NOTHING
RETURNING id, subdomain, name, tier;

-- Verify the tenant was created
SELECT id, subdomain, name, tier, settings, created_at
FROM public.tenants
WHERE subdomain = 'test';
