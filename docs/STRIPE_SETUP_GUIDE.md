# Stripe Setup Guide for TyneBase

This guide walks you through setting up Stripe billing, subscriptions, and credit top-ups for TyneBase. The integration is fully built — you just need to configure Stripe and supply the environment variables.

---

## Overview

TyneBase uses Stripe for:
- **Subscription billing** (Free, Base, Pro, Enterprise tiers)
- **One-time credit pack purchases** (100 / 500 / 1000 credits)
- **Payment processing** via Stripe Checkout (hosted page)
- **Customer portal** for subscription management
- **Webhook handling** for automated tier upgrades and credit top-ups

---

## Step 1: Create Stripe Account

1. **Sign up for Stripe**
   - Visit: https://dashboard.stripe.com/register
   - Complete business verification
   - Enable **test mode** initially (toggle top-left of the dashboard)

2. **Get API keys**
   - Go to: https://dashboard.stripe.com/apikeys
   - Copy:
     - **Secret key** → `STRIPE_SECRET_KEY` (backend only — never expose)
     - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (frontend)

---

## Step 2: Create Products and Prices

### Subscription Plans

Go to: https://dashboard.stripe.com/products → **+ Add product**

#### **Base Plan**
- **Name**: `TyneBase Base Plan`
- **Description**: `For small teams with full AI capabilities (100 credits/month)`
- **Pricing model**: Recurring
- Add two prices:
  - Monthly: **£29.00 / month** → copy `price_...` as `STRIPE_PRICE_BASE_MONTHLY`
  - Yearly: **£276.00 / year** (= £23/mo, 20% off) → copy as `STRIPE_PRICE_BASE_YEARLY`

#### **Pro Plan**
- **Name**: `TyneBase Pro Plan`
- **Description**: `For growing organisations with advanced AI needs (500 credits/month)`
- **Pricing model**: Recurring
- Add two prices:
  - Monthly: **£99.00 / month** → copy as `STRIPE_PRICE_PRO_MONTHLY`
  - Yearly: **£948.00 / year** (= £79/mo, 20% off) → copy as `STRIPE_PRICE_PRO_YEARLY`

#### **Enterprise Plan**  *(optional — contact sales flow)*
- **Name**: `TyneBase Enterprise Plan`
- **Description**: `Custom enterprise solution`
- **Pricing model**: Recurring — custom amount (or set per-customer in the portal)
- Monthly → `STRIPE_PRICE_ENT_MONTHLY`
- Yearly  → `STRIPE_PRICE_ENT_YEARLY`

---

### Credit Top-Up Packs  *(one-time payments)*

These are **one-time purchases** (not subscriptions). Create a separate product for each:

#### **100 Credits Pack**
- **Name**: `TyneBase Credits — 100`
- **Description**: `One-time credit top-up. 100 AI credits added instantly.`
- **Pricing model**: One time
- **Price**: **£10.00** → copy `price_...` as `STRIPE_PRICE_CREDITS_100`

#### **500 Credits Pack**
- **Name**: `TyneBase Credits — 500`
- **Description**: `One-time credit top-up. 500 AI credits added instantly.`
- **Pricing model**: One time
- **Price**: **£40.00** → copy as `STRIPE_PRICE_CREDITS_500`

#### **1000 Credits Pack**
- **Name**: `TyneBase Credits — 1000`
- **Description**: `One-time credit top-up. 1000 AI credits added instantly.`
- **Pricing model**: One time
- **Price**: **£70.00** → copy as `STRIPE_PRICE_CREDITS_1000`

---

## Step 3: Configure Webhooks

You need **two separate webhook endpoints** (or one combined one — see note below):

### Webhook 1 — Subscriptions

1. Go to: https://dashboard.stripe.com/webhooks → **Add endpoint**
2. **Endpoint URL**: `https://your-backend.fly.dev/api/billing/webhook`
3. **Events to listen for**:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### Webhook 2 — Credit Purchases

1. Go to: https://dashboard.stripe.com/webhooks → **Add endpoint**
2. **Endpoint URL**: `https://your-backend.fly.dev/api/credits/webhook`
3. **Events to listen for**:
   - `checkout.session.completed`  *(only processes events with `purchase_type: credit_pack` metadata)*
4. Copy the **Signing secret** → `STRIPE_CREDITS_WEBHOOK_SECRET`

> **Note — Single endpoint option**: If you prefer one webhook, you can point **both Stripe webhooks at `/api/billing/webhook`** and set `STRIPE_CREDITS_WEBHOOK_SECRET` to the same value as `STRIPE_WEBHOOK_SECRET`. The credits purchase handler at `/api/credits/webhook` filters on `metadata.purchase_type === 'credit_pack'`, so it safely ignores subscription events.

---

## Step 4: Environment Variables

### Backend (Fly.io / Docker)

```bash
# ──────────────────────────────────────────────
# Stripe Core
# ──────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_xxx          # or sk_test_xxx for dev

# ──────────────────────────────────────────────
# Stripe Webhook Secrets
# ──────────────────────────────────────────────
STRIPE_WEBHOOK_SECRET=whsec_xxx              # For /api/billing/webhook
STRIPE_CREDITS_WEBHOOK_SECRET=whsec_xxx      # For /api/credits/webhook (can be same as above)

# ──────────────────────────────────────────────
# Subscription Plan Price IDs
# ──────────────────────────────────────────────
STRIPE_PRICE_BASE_MONTHLY=price_xxx
STRIPE_PRICE_BASE_YEARLY=price_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_ENT_MONTHLY=price_xxx
STRIPE_PRICE_ENT_YEARLY=price_xxx

# ──────────────────────────────────────────────
# Credit Pack Price IDs (one-time payments)
# ──────────────────────────────────────────────
STRIPE_PRICE_CREDITS_100=price_xxx     # £10 — 100 credits
STRIPE_PRICE_CREDITS_500=price_xxx     # £40 — 500 credits
STRIPE_PRICE_CREDITS_1000=price_xxx    # £70 — 1000 credits

# ──────────────────────────────────────────────
# Frontend redirect base URL
# ──────────────────────────────────────────────
FRONTEND_URL=https://www.tynebase.com
```

### Frontend (Vercel)

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx   # or pk_test_xxx for dev
```

---

## Step 5: Test the Integration

### Local webhook testing with Stripe CLI

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forward events to your local backend
stripe listen --forward-to http://localhost:8080/api/billing/webhook
stripe listen --forward-to http://localhost:8080/api/credits/webhook

# (Note: copy the whsec_ printed by the CLI into your local .env)
```

### Test checkout flows

1. Start backend: `npm run dev` (from project root)
2. Start frontend: `npm run dev` (from `tynebase-frontend/`)
3. Navigate to `/dashboard/settings/billing`

**Upgrade plan:**
- Click **Upgrade to Base** or **Upgrade to Pro**
- Complete Stripe Checkout with test card `4242 4242 4242 4242`
- You should be redirected back with a success toast and tier updated

**Buy credits (Base/Pro plan required):**
- Scroll to **Buy More Credits**
- Click any credit pack
- Complete Stripe Checkout with test card `4242 4242 4242 4242`
- Credits are added to your monthly pool instantly

**Manage subscription:**
- Click **Manage Subscription** (visible for paid plans)
- Opens the Stripe Customer Portal in a new tab

---

## Step 6: Production Checklist

- [ ] Switch Stripe Dashboard to **Live mode**
- [ ] Re-create all products and prices in live mode
- [ ] Copy live price IDs to production env vars
- [ ] Update both webhook endpoints to production backend URL
- [ ] Update `STRIPE_WEBHOOK_SECRET` and `STRIPE_CREDITS_WEBHOOK_SECRET` with live signing secrets
- [ ] Configure Customer Portal at: https://dashboard.stripe.com/settings/billing/portal
  - Enable invoice history
  - Enable cancellation
  - Add your business logo and colors
- [ ] Test live mode checkout with a real card (then refund)

---

## API Endpoints Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/billing/checkout` | POST | Create subscription checkout session |
| `/api/billing/portal` | POST | Open Stripe Customer Portal |
| `/api/billing/webhook` | POST | Stripe webhook — subscription events |
| `/api/credits/purchase` | POST | Create credit pack checkout session |
| `/api/credits/webhook` | POST | Stripe webhook — credit purchases |

### `POST /api/credits/purchase`

**Body:**
```json
{ "pack": "100" }   // or "500" or "1000"
```

**Requirements:**
- User must be an **admin** on the tenant
- Tenant must be on **Base, Pro, or Enterprise** plan (not Free)

---

## Troubleshooting

### "Stripe is not configured"
- **Cause**: Missing `STRIPE_SECRET_KEY`
- **Fix**: Add the env var and redeploy

### "No Stripe price configured for base (monthly)"
- **Cause**: Missing `STRIPE_PRICE_BASE_MONTHLY`
- **Fix**: Add all `STRIPE_PRICE_*` env vars

### "The 100 Credits credit pack is not yet available"
- **Cause**: Missing `STRIPE_PRICE_CREDITS_100`
- **Fix**: Create the credit pack product in Stripe and add the price ID env var

### "Upgrade required" when buying credits
- **Cause**: Tenant is on the Free plan
- **Fix**: Expected behaviour — user must upgrade to Base or higher first

### Webhook signature verification failed
- **Cause**: Wrong webhook secret, raw body not available, or forwarded behind a proxy
- **Fix**:
  1. Confirm `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint's signing secret
  2. Ensure Fastify is configured with `rawBody: true`
  3. Confirm no middleware is parsing the body before the webhook handler

### Credits not added after purchase
- **Cause**: Webhook not delivering or `metadata.purchase_type` mismatch
- **Fix**:
  1. Check Stripe Dashboard → Webhooks → view recent events for delivery status
  2. Confirm `/api/credits/webhook` endpoint is reachable
  3. Confirm `STRIPE_CREDITS_WEBHOOK_SECRET` is correct

### Customer portal not working
- **Cause**: Tenant has no `stripe_customer_id` in settings
- **Fix**: Complete a checkout first; the customer is created automatically

---

## Security Notes

1. **Never expose** `STRIPE_SECRET_KEY` in frontend code or logs
2. **Always verify** webhook signatures before processing events
3. **Only admins** can initiate checkouts or purchase credits (enforced server-side)
4. **All billing events** are audit-logged to the `audit_logs` table
5. **Use HTTPS** for all webhook endpoints in production
