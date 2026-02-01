# TyneBase Production Deployment Guide

**Created**: 2026-01-27  
**Status**: Planning Document

---

## Table of Contents
1. [Multi-Tenancy Architecture in Production](#multi-tenancy-architecture-in-production)
2. [Domain & SSL Management](#domain--ssl-management)
3. [Deployment Options](#deployment-options)
4. [Recommended: Fly.io Deployment](#recommended-flyio-deployment)
5. [Alternative: Vercel + Fly.io Hybrid](#alternative-vercel--flyio-hybrid)
6. [DNS Configuration](#dns-configuration)
7. [SSL Certificate Provisioning](#ssl-certificate-provisioning)

---

## Multi-Tenancy Architecture in Production

### How Wildcard Subdomains Work

TyneBase uses **wildcard subdomain routing** for multi-tenancy:

```
tynebase.com              → Root domain (marketing site)
*.tynebase.com            → Wildcard for all tenant subdomains
acme.tynebase.com         → Tenant "acme"
bigcorp.tynebase.com      → Tenant "bigcorp"
startup123.tynebase.com   → Tenant "startup123"
```

### Key Concept: No Per-Tenant Provisioning Needed

**You don't provision individual domains or SSL certificates for each tenant.** Instead:

1. **One wildcard DNS record** covers all subdomains
2. **One wildcard SSL certificate** secures all subdomains
3. **Application routing** (proxy.ts) handles tenant resolution

This is how SaaS platforms like Slack, Notion, and GitHub handle multi-tenancy:
- `yourcompany.slack.com`
- `yourteam.notion.so`
- `yourorg.github.io`

---

## Domain & SSL Management

### What You Need to Set Up Once

#### 1. Root Domain
Purchase and configure your root domain (e.g., `tynebase.com`) through a registrar like:
- Namecheap
- Google Domains
- Cloudflare Registrar
- GoDaddy

#### 2. DNS Configuration

Add these DNS records to your domain:

```dns
# Root domain
A     @                  → Your server IP (or CNAME to hosting provider)
AAAA  @                  → Your server IPv6 (optional)

# Wildcard subdomain (this is the magic!)
A     *                  → Your server IP (or CNAME to hosting provider)
AAAA  *                  → Your server IPv6 (optional)

# WWW redirect (optional)
CNAME www                → tynebase.com
```

**The `*` wildcard record** means:
- `acme.tynebase.com` → resolves to your server
- `newcustomer.tynebase.com` → resolves to your server
- `anything.tynebase.com` → resolves to your server

No need to add DNS records for each new tenant!

#### 3. SSL Certificate (Wildcard)

Get a **wildcard SSL certificate** that covers `*.tynebase.com`:

**Option A: Let's Encrypt (Free, Automated)**
```bash
# Using certbot
certbot certonly --dns-cloudflare \
  -d tynebase.com \
  -d *.tynebase.com
```

**Option B: Cloudflare (Free, Automatic)**
- Cloudflare provides free wildcard SSL when you use their proxy
- Automatically renews
- No manual certificate management

**Option C: Platform-Managed (Recommended)**
- Fly.io, Vercel, Railway all provide automatic SSL
- They handle certificate provisioning and renewal
- No manual work required

---

## Deployment Options

### Option 1: Fly.io (Recommended for Full-Stack)

**Pros:**
- Handles wildcard SSL automatically
- Supports both frontend and backend in one platform
- PostgreSQL (Supabase) compatible
- WebSocket support for collaboration server
- Global edge deployment
- Simple configuration

**Cons:**
- More expensive than serverless options
- Requires Docker knowledge

**Cost Estimate:**
- Shared CPU: ~$5-10/month
- Dedicated CPU: ~$30-50/month
- PostgreSQL: Included with Supabase

---

### Option 2: Vercel (Frontend) + Fly.io (Backend)

**Pros:**
- Vercel excels at Next.js hosting
- Automatic edge deployment
- Great DX for frontend
- Fly.io handles backend + WebSockets

**Cons:**
- Split infrastructure
- More complex DNS setup
- Two platforms to manage

**Cost Estimate:**
- Vercel Pro: $20/month (for wildcard domains)
- Fly.io backend: $5-10/month

---

### Option 3: Railway

**Pros:**
- Simple deployment
- Automatic SSL
- Good for monorepos
- Affordable

**Cons:**
- Less mature than Fly.io
- Fewer regions

---

### Option 4: Self-Hosted (VPS)

**Pros:**
- Full control
- Potentially cheaper at scale
- No vendor lock-in

**Cons:**
- Manual SSL management
- DevOps overhead
- Security responsibility
- No automatic scaling

---

## Recommended: Fly.io Deployment

### Why Fly.io for TyneBase?

1. **Wildcard SSL out of the box** - No configuration needed
2. **WebSocket support** - Critical for Hocuspocus collaboration
3. **Multi-region** - Deploy close to users
4. **Docker-based** - Consistent with your existing setup
5. **PostgreSQL** - Works with Supabase or Fly Postgres

### Architecture on Fly.io

```
Internet
    ↓
Fly.io Edge (Automatic SSL)
    ↓
┌─────────────────────────────────┐
│  Fly.io App (tynebase)          │
│  ┌──────────────────────────┐   │
│  │  Next.js Frontend        │   │
│  │  Port 3000               │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  Fastify Backend         │   │
│  │  Port 8080               │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  Hocuspocus Collab       │   │
│  │  Port 8081               │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
    ↓
Supabase (PostgreSQL + Auth)
```

### Fly.io Configuration

You already have `fly.toml` in your repo. Here's what it needs:

```toml
app = "tynebase"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  # Wildcard domain support
  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[env]
  NODE_ENV = "production"
  PORT = "3000"
  BACKEND_PORT = "8080"
  COLLAB_PORT = "8081"
```

### SSL Certificate Provisioning on Fly.io

**Automatic Process:**

1. **Add your domain:**
```bash
fly certs add tynebase.com
fly certs add *.tynebase.com
```

2. **Fly.io provisions Let's Encrypt certificate:**
   - Validates domain ownership via DNS
   - Issues wildcard certificate
   - Auto-renews every 60 days

3. **Update DNS:**
```bash
# Fly.io will show you the DNS records to add
fly certs show tynebase.com
```

Add the provided CNAME/A records to your DNS:
```dns
A     @    → 66.241.124.xxx (Fly.io IP)
A     *    → 66.241.124.xxx (Fly.io IP)
```

4. **Done!** All subdomains now have SSL:
   - `https://tynebase.com` ✅
   - `https://acme.tynebase.com` ✅
   - `https://newcustomer.tynebase.com` ✅

**Certificate renewal is automatic** - Fly.io handles it.

---

## Alternative: Vercel + Fly.io Hybrid

### When to Use This

- You want Vercel's superior Next.js DX
- You need Fly.io for backend/WebSockets
- You're willing to manage split infrastructure

### Architecture

```
Internet
    ↓
┌─────────────────────────────────┐
│  Vercel (Frontend)              │
│  - Next.js on Edge              │
│  - Automatic SSL                │
│  - *.tynebase.com               │
└─────────────────────────────────┘
    ↓ API calls
┌─────────────────────────────────┐
│  Fly.io (Backend)               │
│  - Fastify API                  │
│  - Hocuspocus                   │
│  - api.tynebase.com             │
└─────────────────────────────────┘
    ↓
Supabase
```

### DNS Configuration

```dns
# Vercel handles frontend wildcard
A     @              → 76.76.21.21 (Vercel)
CNAME *              → cname.vercel-dns.com
CNAME www            → cname.vercel-dns.com

# Fly.io handles backend
CNAME api            → tynebase-api.fly.dev
CNAME ws             → tynebase-api.fly.dev
```

### Vercel Wildcard Setup

1. **Upgrade to Vercel Pro** ($20/month) - Required for wildcard domains

2. **Add domain in Vercel:**
```bash
vercel domains add tynebase.com
vercel domains add *.tynebase.com
```

3. **Configure DNS as shown above**

4. **Vercel provisions SSL automatically** for both root and wildcard

### Pros/Cons

**Pros:**
- Best Next.js performance (Vercel's edge network)
- Automatic image optimization
- Excellent caching
- Great analytics

**Cons:**
- Vercel Pro required ($20/month)
- Split infrastructure complexity
- CORS configuration needed
- Two platforms to monitor

---

## DNS Configuration Deep Dive

### Understanding Wildcard DNS

When a user visits `acme.tynebase.com`:

1. **DNS Lookup:**
   - Browser asks: "What's the IP for `acme.tynebase.com`?"
   - DNS server checks for exact match → not found
   - DNS server checks for wildcard `*.tynebase.com` → found!
   - Returns: `66.241.124.xxx` (your server IP)

2. **HTTP Request:**
   - Browser connects to `66.241.124.xxx`
   - Sends: `Host: acme.tynebase.com`

3. **Application Routing:**
   - Your Next.js proxy.ts receives request
   - Extracts subdomain: `acme`
   - Routes to appropriate tenant

### DNS Propagation

After adding DNS records:
- **Cloudflare**: 1-5 minutes
- **Other providers**: 1-24 hours
- **Global propagation**: Up to 48 hours

Check propagation:
```bash
# Check if wildcard is working
dig acme.tynebase.com
dig randomname.tynebase.com

# Both should return the same IP
```

---

## SSL Certificate Provisioning

### How Wildcard SSL Works

A wildcard certificate for `*.tynebase.com` covers:
- ✅ `acme.tynebase.com`
- ✅ `customer1.tynebase.com`
- ✅ `anything.tynebase.com`
- ❌ `tynebase.com` (root domain needs separate cert)
- ❌ `sub.acme.tynebase.com` (nested subdomains not covered)

**Solution:** Get certificate for both:
```
tynebase.com
*.tynebase.com
```

### Let's Encrypt (Free)

**Manual Setup:**
```bash
# Install certbot
sudo apt-get install certbot

# Get wildcard certificate (requires DNS validation)
sudo certbot certonly --manual \
  --preferred-challenges=dns \
  -d tynebase.com \
  -d *.tynebase.com

# Add TXT record as instructed
# Certificate saved to: /etc/letsencrypt/live/tynebase.com/
```

**Automated with Cloudflare:**
```bash
# Install Cloudflare plugin
sudo apt-get install python3-certbot-dns-cloudflare

# Create credentials file
cat > cloudflare.ini << EOF
dns_cloudflare_api_token = YOUR_API_TOKEN
EOF

# Get certificate (fully automated!)
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials cloudflare.ini \
  -d tynebase.com \
  -d *.tynebase.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Cloudflare (Easiest)

1. **Add domain to Cloudflare**
2. **Enable Cloudflare proxy** (orange cloud)
3. **SSL/TLS → Full (strict)**
4. **Done!** Cloudflare provides:
   - Wildcard SSL automatically
   - Auto-renewal
   - DDoS protection
   - CDN

**No certificate management needed.**

### Platform-Managed (Recommended)

**Fly.io:**
```bash
fly certs add tynebase.com
fly certs add *.tynebase.com
# Automatic Let's Encrypt provisioning
# Auto-renewal every 60 days
```

**Vercel:**
```bash
vercel domains add tynebase.com
vercel domains add *.tynebase.com
# Automatic SSL provisioning
# Auto-renewal
```

**Railway:**
```bash
# Add domain in dashboard
# SSL provisioned automatically
```

---

## Step-by-Step Production Deployment

### Phase 1: Domain Setup (One-Time)

1. **Purchase domain** (e.g., `tynebase.com`)
2. **Add to Cloudflare** (recommended) or your DNS provider
3. **Configure DNS:**
   ```dns
   A     @    → (will be provided by hosting platform)
   A     *    → (will be provided by hosting platform)
   ```

### Phase 2: Choose Hosting Platform

**Option A: Fly.io (Recommended)**

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
fly deploy

# Add domain
fly certs add tynebase.com
fly certs add *.tynebase.com

# Update DNS with Fly.io IPs
fly ips list
```

**Option B: Vercel + Fly.io**

```bash
# Frontend to Vercel
cd tynebase-frontend
vercel --prod
vercel domains add tynebase.com
vercel domains add *.tynebase.com

# Backend to Fly.io
cd ../backend
fly deploy
fly certs add api.tynebase.com
```

### Phase 3: Environment Variables

Set in your hosting platform:

```env
# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
NEXT_PUBLIC_API_URL=https://api.tynebase.com
NEXT_PUBLIC_BASE_DOMAIN=tynebase.com

# Backend
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
ALLOWED_ORIGINS=https://tynebase.com,https://*.tynebase.com
```

### Phase 4: Test

```bash
# Test root domain
curl https://tynebase.com

# Test wildcard
curl https://test123.tynebase.com

# Test SSL
curl -vI https://acme.tynebase.com 2>&1 | grep -i ssl
```

---

## Cost Breakdown

### Fly.io (Full Stack)
- **App hosting**: $5-10/month (shared CPU)
- **Domain**: $10-15/year
- **SSL**: Free (Let's Encrypt)
- **Supabase**: Free tier or $25/month
- **Total**: ~$10-40/month

### Vercel + Fly.io
- **Vercel Pro**: $20/month (required for wildcard)
- **Fly.io backend**: $5-10/month
- **Domain**: $10-15/year
- **SSL**: Free (automatic)
- **Supabase**: Free tier or $25/month
- **Total**: ~$30-60/month

### Self-Hosted VPS
- **VPS**: $5-20/month (DigitalOcean, Linode)
- **Domain**: $10-15/year
- **SSL**: Free (Let's Encrypt)
- **Supabase**: Free tier or $25/month
- **Total**: ~$10-50/month + DevOps time

---

## FAQ

### Q: Do I need to buy a domain for each tenant?
**A:** No! One domain with wildcard DNS covers all tenants.

### Q: Do I need separate SSL certificates for each tenant?
**A:** No! One wildcard SSL certificate (`*.tynebase.com`) covers all tenant subdomains.

### Q: How many tenants can I support?
**A:** Unlimited. The wildcard DNS/SSL covers infinite subdomains.

### Q: What if a tenant wants their own domain (e.g., `acme.com`)?
**A:** That's a custom domain feature. You'd need to:
1. Let tenant add CNAME: `app.acme.com → acme.tynebase.com`
2. Provision SSL for `app.acme.com` (Let's Encrypt or platform-managed)
3. Update your proxy.ts to handle custom domains

This is an advanced feature for later.

### Q: How does proxy.ts know which tenant?
**A:** It extracts the subdomain from the `Host` header:
```typescript
// Request to: https://acme.tynebase.com/dashboard
const hostname = request.headers.get("host"); // "acme.tynebase.com"
const subdomain = extractSubdomain(hostname, "tynebase.com"); // "acme"
```

### Q: What about SSL certificate renewal?
**A:** Automatic with:
- Fly.io: Auto-renews every 60 days
- Vercel: Auto-renews
- Cloudflare: Auto-renews
- Let's Encrypt with certbot: Set up cron job

### Q: Can I use Cloudflare with Fly.io?
**A:** Yes! Recommended setup:
1. Domain registered anywhere
2. DNS managed by Cloudflare
3. Cloudflare proxy enabled (orange cloud)
4. Points to Fly.io
5. Benefits: DDoS protection, CDN, automatic SSL

---

## Recommended Production Setup

For TyneBase, I recommend:

```
Domain: tynebase.com (Namecheap/Google Domains)
    ↓
DNS: Cloudflare (free tier)
    ↓
Hosting: Fly.io (full stack)
    ↓
Database: Supabase (managed PostgreSQL)
```

**Why:**
1. **Cloudflare** - Free SSL, DDoS protection, CDN
2. **Fly.io** - Simple deployment, automatic SSL, WebSocket support
3. **Supabase** - Managed PostgreSQL, built-in auth
4. **Total cost**: ~$10-15/month to start

**Setup time**: ~1 hour

**Maintenance**: Minimal (automatic SSL renewal, automatic deployments)
