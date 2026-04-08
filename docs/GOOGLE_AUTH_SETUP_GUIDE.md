# Google Authentication Setup Guide for TyneBase

This guide walks your colleague Dan through setting up Google OAuth authentication through Google Cloud Console (GCC) for the TyneBase application.

## Overview

TyneBase uses Supabase for authentication with Google OAuth as an external provider. The setup involves:
1. Creating a Google Cloud project
2. Configuring OAuth credentials
3. Setting up Supabase authentication
4. Configuring environment variables

---

## Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account ( support@tynebase.com )

2. **Create a new project**
   - Click the project dropdown at the top
   - Click "NEW PROJECT"
   - Enter project name: `TyneBase` (or your preferred name)
   - Click "CREATE"

3. **Enable required APIs**
   - In the navigation menu, go to "APIs & Services" > "Library"
   - Search and enable:
     - "Google+ API" (if available) or "People API"
     - "Google Identity Platform API"

---

## Step 2: Configure OAuth Consent Screen

1. **Set up OAuth consent screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose **External** (for production) or **Internal** (for testing)
   - Click "CREATE"

2. **Fill in app information**
   - **App name**: `TyneBase`
   - **User support email**: support@tynebase.com
   - **Developer contact information**: ennersmai@gmail.com
   - Click "SAVE AND CONTINUE"

3. **Configure scopes**
   - Click "ADD OR REMOVE SCOPES"
   - Add these scopes:
     - `../auth/userinfo.email`
     - `../auth/userinfo.profile`
     - `openid`
   - Click "SAVE AND CONTINUE"

4. **Test users (for External apps)**
   - Add test users (your email addresses)
   - Click "SAVE AND CONTINUE"

5. **Review and publish**
   - Review all settings
   - Click "BACK TO DASHBOARD"

---

## Step 3: Create OAuth Credentials

1. **Create credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "+ CREATE CREDENTIALS"
   - Select "OAuth client ID"

2. **Configure application type**
   - **Application type**: "Web application"
   - **Name**: `TyneBase Web App`

3. **Add authorized redirect URIs**
   - Click "+ ADD URI"
   - Add the following URIs (replace with your actual domains):
   
   
   **For production:**
   ```
   https://tynebase.com/auth/callback
   https://www.tynebase.com/auth/callback
   ```
   

4. **Create credentials**
   - Click "CREATE"
   - **IMPORTANT**: Copy and save your:
     - **Client ID**
     - **Client Secret**
   - These cannot be recovered later!

---

## Step 4: Configure Supabase

1. **Access Supabase Dashboard**
   - Go to your Supabase project: https://app.supabase.com
   - Select your TyneBase project

2. **Enable Google provider**
   - Go to "Authentication" > "Providers"
   - Find "Google" in the list
   - Click the toggle to enable it

3. **Configure Google provider**
   - **Client ID**: Paste your Google Client ID
   - **Client Secret**: Paste your Google Client Secret
   - **Enable signups**: Keep checked
   - Click "Save"

4. **Update redirect URLs in Supabase**
   - Go to "Authentication" > "URL Configuration"
   - **Site URL**: Set to your production URL (e.g., `https://yourdomain.com`)
   - **Redirect URLs**: Add the same URLs from Step 3:
     ```
     http://127.0.0.1:3000/auth/callback
     http://localhost:3000/auth/callback
     https://yourdomain.com/auth/callback
     ```

---

## Step 5: Update Environment Variables

1. **Update `.env.local` in frontend**
   ```bash
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your-google-client-id-here
   GOOGLE_CLIENT_SECRET=your-google-client-secret-here
   ```

2. **Update Supabase config (if needed)**
   - In `supabase/config.toml`, ensure Google is enabled:
   ```toml
   [auth.external.google]
   enabled = true
   client_id = "env(GOOGLE_CLIENT_ID)"
   secret = "env(GOOGLE_CLIENT_SECRET)"
   ```

---

## Step 6: Test the Integration

1. **Start your development server**
   ```bash
   npm run dev
   ```

2. **Test Google sign-in**
   - Navigate to `http://localhost:3000/login`
   - Click the "Continue with Google" button
   - You should be redirected to Google's OAuth consent screen
   - After approval, you should be redirected back to your app

3. **Check for common issues**
   - **"redirect_uri_mismatch"**: Verify redirect URIs match exactly in Google Console and Supabase
   - **"invalid_client"**: Check Client ID and Secret are correct
   - **"access_denied"**: Ensure OAuth consent screen is properly configured

---

## Production Deployment Checklist

1. **Update production environment variables**
   - Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to your hosting provider
   - For Vercel: Project Settings > Environment Variables
   - For other providers: Use their environment variable system

2. **Update production redirect URIs**
   - In Google Console, add your production domain to authorized redirect URIs
   - In Supabase, update Site URL and redirect URLs

3. **Publish OAuth app**
   - In Google Console, go to OAuth consent screen
   - Click "PUBLISH APP" (for production use)

4. **Test in production**
   - Deploy your application
   - Test the complete OAuth flow
   - Verify user creation and authentication works

---

## Troubleshooting Common Issues

### "redirect_uri_mismatch" Error
- **Cause**: Redirect URI in request doesn't match authorized URIs
- **Solution**: 
  1. Check the exact URI in the error message
  2. Add it to Google Console under "Authorized redirect URIs"
  3. Ensure no trailing slashes or protocol differences

### "invalid_client" Error
- **Cause**: Client ID or Secret is incorrect
- **Solution**:
  1. Double-check the credentials in Google Console
  2. Ensure no extra spaces or characters
  3. Verify environment variables are properly set

### Users not being created in database
- **Cause**: Supabase auth hook or database issue
- **Solution**:
  1. Check Supabase Authentication logs
  2. Verify user creation triggers are working
  3. Check database constraints

### CORS issues
- **Cause**: Frontend and backend domains don't match
- **Solution**:
  1. Ensure proper CORS configuration
  2. Check environment variables for correct URLs

---

## Security Best Practices

1. **Never commit secrets to version control**
   - Always use environment variables
   - Add `.env.local` to `.gitignore`

2. **Use HTTPS in production**
   - All redirect URIs should use HTTPS
   - Ensure SSL certificates are valid

3. **Regularly review OAuth scopes**
   - Only request necessary permissions
   - Remove unused scopes

4. **Monitor authentication logs**
   - Check Supabase auth logs regularly
   - Set up alerts for suspicious activity

5. **Implement rate limiting**
   - Supabase has built-in rate limiting
   - Configure appropriate limits in `supabase/config.toml`

---

## Required Information for Your Colleague

**Google Cloud Console Setup:**
- Project: `TyneBase Auth`
- OAuth consent: External
- Scopes: `email`, `profile`, `openid`
- Redirect URIs: `http://localhost:3000/auth/callback` (dev), `https://yourdomain.com/auth/callback` (prod)

**Supabase Configuration:**
- Enable Google provider in Authentication > Providers
- Add Client ID and Secret
- Configure redirect URLs in URL Configuration

**Environment Variables:**
```bash
GOOGLE_CLIENT_ID=from-google-console
GOOGLE_CLIENT_SECRET=from-google-console
```

**Testing:**
- Local: `http://localhost:3000/login`
- Production: `https://yourdomain.com/login`

---

## Support Resources

- **Google Cloud OAuth Documentation**: https://developers.google.com/identity/protocols/oauth2
- **Supabase Auth Documentation**: https://supabase.com/docs/guides/auth
- **TyneBase Code Reference**: Check `tynebase-frontend/app/login/page.tsx` for Google login implementation

If you encounter any issues, check the browser console for detailed error messages and verify all URLs and credentials match exactly across platforms.
