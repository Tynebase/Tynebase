Completed: Credit Purchase System + Billing Page Overhaul + Production Fixes
All changes committed and pushed to main (16 files, 2036 insertions).

/dashboard/settings/billing — Complete Rewrite
Was broken:

Hardcoded "Free Tier" regardless of actual plan
"Upgrade Plan" button did nothing
Base plan (£29/mo) was completely missing
Pro plan incorrectly priced at £29 (should be £99)
No credit balance display
No way to purchase credits
Now works:

billing/page.tsx — fully dynamic from useTenant() context
Current plan card shows actual tier, price, features, credit allocation
Upgrade Plan button calls POST /api/billing/checkout → Stripe Checkout redirect
Monthly/yearly toggle on upgrade cards (20% saving)
Base (£29/mo) and Pro (£99/mo) both shown with correct features
Credit balance card with colour-coded progress bar + low/exhausted warnings
Buy Credits section: 100 (£10) / 500 (£40) / 1000 (£70) packs — calls new POST /api/credits/purchase route
Free tier users see an upsell prompt in the credits section instead of the purchase cards
"Manage Subscription" opens Stripe Customer Portal in a new tab
Handles ?success, ?credits_purchased, ?canceled redirect params from Stripe
Non-admin users see a notice; all billing actions are gated client + server side
New Backend Routes (src/routes/credits-purchase.ts)
POST /api/credits/purchase

Validates admin role + paid plan (Free tier returns UPGRADE_REQUIRED)
Creates/reuses Stripe customer, stamps tenant_id metadata
Mode: payment (one-time), success/cancel redirect back to billing page
POST /api/credits/webhook

Validates Stripe signature with STRIPE_CREDITS_WEBHOOK_SECRET
Filters on metadata.purchase_type === 'credit_pack' to ignore subscription events
Adds purchased credits to existing credit_pools row for current month
If no pool exists, seeds one with tier_credits + purchased_credits
Full audit log entry per purchase
Registered in src/server.ts
Production Bug Fixes Found & Fixed
File	Bug	Fix
src/middleware/creditGuard.ts	Missing pool returned 403, blocking all AI ops at month rollover	Auto-initialises pool from tenant tier; handles race condition via PG unique-constraint
src/routes/ai-generate.ts	Queried non-existent credit_allocations table	Changed to credit_pools with correct columns; improved low-credit threshold to 10%
src/routes/documents.ts	Queried non-existent tenant_credits table	Changed to credit_pools, fixed field names, added month_year filter
src/routes/dashboard.ts	Enterprise default credits set to 2000, inconsistent with all other files	Changed to 1000
DB Migration (20260408000000_fix_credit_decimal_support.sql)
DeepSeek operations cost 0.2 credits, but INTEGER columns silently truncated this to 0, making DeepSeek effectively free and undermining the credit system:

credit_pools.total_credits / used_credits: INTEGER → NUMERIC(10,2)
query_usage.credits_charged: INTEGER → NUMERIC(10,2)
deduct_credits() and get_credit_balance() SQL functions updated to use NUMERIC
Env Vars to Add in Production
STRIPE_PRICE_CREDITS_100=price_xxx    # £10 — 100 credits (one-time)
STRIPE_PRICE_CREDITS_500=price_xxx    # £40 — 500 credits (one-time)
STRIPE_PRICE_CREDITS_1000=price_xxx   # £70 — 1000 credits (one-time)
STRIPE_CREDITS_WEBHOOK_SECRET=whsec_xxx  # For /api/credits/webhook

See docs/STRIPE_SETUP_GUIDE.md for full setup instructions including Stripe product creation steps.