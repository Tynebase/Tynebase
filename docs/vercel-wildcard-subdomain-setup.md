# Vercel Wildcard Subdomain Setup Guide

This guide explains how to configure Vercel to support branded subdomains (`acme.tynebase.com`) for Pro and Enterprise tenants.

---

## 1. Add Wildcard Domain in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the **tynebase-frontend** project
3. Navigate to **Settings → Domains**
4. Add these domains:
   ```
   tynebase.com
   *.tynebase.com
   ```
5. Vercel will show DNS records you need to add

---

## 2. Configure DNS (Cloudflare / Your DNS Provider)

Add the following DNS records for `tynebase.com`:

| Type  | Name | Value              | TTL  |
|-------|------|--------------------|------|
| A     | @    | 76.76.21.21        | Auto |
| CNAME | www  | cname.vercel-dns.com | Auto |
| CNAME | *    | cname.vercel-dns.com | Auto |

> The `*` CNAME record is the **wildcard** — it routes all subdomains (`acme.tynebase.com`, `bigcorp.tynebase.com`, etc.) to Vercel.

If using **Cloudflare**, set the wildcard record's proxy status to **DNS only** (grey cloud), not proxied.

---

## 3. How It Works End-to-End

### Request Flow
```
User visits acme.tynebase.com
  → DNS resolves *.tynebase.com → Vercel
  → Vercel serves Next.js app
  → proxy.ts extracts subdomain "acme" from Host header
  → TenantContext fetches tenant branding from API
  → App renders with Acme's brand colors, logo, company name
```

### What proxy.ts Does
- Extracts subdomain from the `Host` header
- Blocks reserved subdomains (`www`, `api`, `admin`, etc.)
- Sets `x-tenant-subdomain` header for downstream use
- Redirects unauthenticated users on protected routes to `/login`

### What TenantContext Does
- Reads subdomain from hostname (or localStorage fallback)
- Fetches tenant branding from `GET /api/tenants/public/:subdomain`
- Applies CSS variables: `--brand`, `--brand-dark`, etc.
- Shows tenant's company name and logo

---

## 4. Branding That Gets Applied

When a Pro/Enterprise tenant customises their branding, these are applied on their subdomain:

| Setting        | Where Applied                     |
|----------------|-----------------------------------|
| Company name   | Sidebar header, page titles       |
| Primary color  | `--brand` CSS variable (buttons, links, accents) |
| Secondary color| `--brand-secondary` (highlights)  |
| Logo (light)   | Sidebar logo, login page          |
| Logo (dark)    | Dark mode sidebar                 |
| Favicon        | Browser tab icon                  |

### CSS Variables Set by TenantContext
```css
--brand: <primary_color>
--brand-dark: <primary_color darkened>
--brand-light: <primary_color lightened>
```

---

## 5. Tier Restrictions

| Tier       | Subdomain | Custom Branding |
|------------|-----------|-----------------|
| Free       | None      | No              |
| Base       | None      | No              |
| Pro        | Custom    | Full            |
| Enterprise | Custom    | Full            |

- Free/Base tenants have `subdomain = null` in the database
- Only Pro/Enterprise tenants can set a subdomain during signup
- The branding page is locked (greyed out) for Free/Base tiers

---

## 6. Vercel Environment Variables

Ensure these are set in Vercel project settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
NEXT_PUBLIC_API_URL=https://tynebase-backend.fly.dev
NEXT_PUBLIC_BASE_DOMAIN=tynebase.com
```

---

## 7. Testing

1. Create a Pro tenant with subdomain `test`
2. Visit `test.tynebase.com` — should show the app with that tenant's branding
3. Visit `tynebase.com` — should show the main marketing site / default app
4. Visit `nonexistent.tynebase.com` — should show tenant-not-found page

---

## 8. Troubleshooting

- **Subdomain not resolving**: Check DNS wildcard record is set correctly
- **SSL error**: Vercel auto-provisions SSL for wildcard domains, may take a few minutes
- **Branding not showing**: Check TenantContext is fetching from the correct API URL
- **Cloudflare 1000 redirect**: Disable Cloudflare proxy (grey cloud) for the wildcard CNAME
