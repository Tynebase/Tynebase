# Google OAuth Setup Guide

This guide walks you through enabling Google Sign-In for TyneBase.

## 1. Google Cloud Console Setup

### Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services → Credentials**
4. Click **+ CREATE CREDENTIALS → OAuth client ID**
5. If prompted, configure the **OAuth consent screen** first:
   - User Type: **External** (or Internal if using Google Workspace)
   - App name: `TyneBase`
   - User support email: your email
   - Authorized domains: `tynebase.com`
   - Developer contact: your email
   - Scopes: add `email`, `profile`, `openid`
   - Save and continue

### Create OAuth Client ID

1. Application type: **Web application**
2. Name: `TyneBase Web`
3. **Authorized JavaScript origins:**
   ```
   https://tynebase.com
   https://<your-supabase-project-ref>.supabase.co
   http://localhost:3000
   ```
4. **Authorized redirect URIs:**
   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   http://localhost:54321/auth/v1/callback
   ```
   > Replace `<your-supabase-project-ref>` with your actual Supabase project reference ID (found in Supabase dashboard → Settings → General).

5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

---

## 2. Supabase Setup

### Enable Google Provider

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication → Providers**
4. Find **Google** and toggle it **ON**
5. Enter your credentials:
   - **Client ID**: paste from Google Cloud Console
   - **Client Secret**: paste from Google Cloud Console
6. **Authorized Client IDs**: leave empty (or add your Client ID if you want extra validation)
7. Click **Save**

### Configure Redirect URLs

1. In Supabase Dashboard → **Authentication → URL Configuration**
2. **Site URL**: `https://tynebase.com` (or `http://localhost:3000` for local dev)
3. **Redirect URLs** — add all of these:
   ```
   https://tynebase.com/auth/callback
   https://*.tynebase.com/auth/callback
   http://localhost:3000/auth/callback
   ```

---

## 3. Environment Variables

### Frontend (`.env.local`)

These should already be set for Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

No additional env vars are needed for Google OAuth — it's all configured through Supabase.

---

## 4. How the Flow Works

### Email Signup
1. User fills in workspace name + credentials on `/signup`
2. Backend creates auth user + tenant + user record in one transaction
3. User is redirected to `/dashboard`

### Google Signup
1. User fills in account type + workspace name on `/signup`
2. Clicks "Continue with Google"
3. Pending signup data (workspace name, account type, tier) is saved to `localStorage`
4. User is redirected to Google OAuth via Supabase
5. Google authenticates user → redirects to `/auth/callback`
6. Callback exchanges code for session → redirects to `/auth/complete-signup`
7. `/auth/complete-signup` reads `localStorage`, shows plan selection (if company)
8. Calls `POST /api/auth/complete-oauth-signup` with JWT + workspace details
9. Backend creates tenant + user record (auth user already exists from OAuth)
10. User is redirected to `/dashboard`

### Google Login (returning user)
1. User clicks "Sign in with Google" on `/login`
2. Google authenticates → Supabase session is created
3. Callback redirects to `/dashboard` (user already has tenant + profile)

---

## 5. Testing Locally

1. Ensure your Supabase project has Google provider enabled
2. Add `http://localhost:3000/auth/callback` to Supabase redirect URLs
3. Add `http://localhost:3000` to Google authorized JavaScript origins
4. Add `http://localhost:54321/auth/v1/callback` to Google authorized redirect URIs
5. Run the app: `npm run dev`
6. Go to `http://localhost:3000/signup` → try "Continue with Google"

---

## 6. Production Checklist

- [ ] Google Cloud Console: OAuth consent screen published (not in testing mode)
- [ ] Google Cloud Console: production redirect URIs added
- [ ] Supabase: Google provider enabled with correct Client ID/Secret
- [ ] Supabase: all redirect URLs added (including `*.tynebase.com`)
- [ ] Supabase: Site URL set to `https://tynebase.com`
- [ ] Vercel: wildcard domain `*.tynebase.com` configured
