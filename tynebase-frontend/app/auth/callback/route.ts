import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tenant = searchParams.get("tenant");
  const redirect = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  console.log('[Auth Callback] Params:', { code: code ? 'present' : 'missing', tenant, errorParam, errorDescription });

  // Handle Supabase error redirects (e.g., expired links)
  if (errorParam) {
    console.error('[Auth Callback] Supabase error:', errorParam, errorDescription);

    // Provide user-friendly messages for common errors
    const isExpired = errorDescription?.includes('expired') || errorParam === 'access_denied';
    if (isExpired) {
      return NextResponse.redirect(
        `${origin}/login?error=invite_expired&message=${encodeURIComponent('This invitation link has expired. Please ask the workspace admin to resend the invite.')}`
      );
    }

    return NextResponse.redirect(
      `${origin}/login?error=${errorParam}&message=${encodeURIComponent(errorDescription || 'Authentication failed. Please try again.')}`
    );
  }

  if (!code) {
    console.error('[Auth Callback] No code provided');
    return NextResponse.redirect(`${origin}/login?error=auth_failed&message=${encodeURIComponent('No authentication code was received. Please try the invitation link again.')}`);
  }

  const supabase = await createClient();
  
  // Diagnostic logging for PKCE verifier
  const cookieStore = await cookies();
  const sbCookies = cookieStore.getAll().filter((c: any) => c.name.startsWith('sb-'));
  console.log('[Auth Callback] Supabase cookies:', sbCookies.map((c: any) => c.name));
  
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[Auth Callback] Session exchange error:', error.message);

    // Expired or invalid code
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      return NextResponse.redirect(
        `${origin}/login?error=invite_expired&message=${encodeURIComponent('This link has expired. Please ask the workspace admin to resend the invite.')}`
      );
    }

    return NextResponse.redirect(
      `${origin}/login?error=session_error&message=${encodeURIComponent(error.message)}`
    );
  }

  if (!data.user) {
    console.error('[Auth Callback] No user in session data');
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Check if this is an invited user (has invite metadata)
  const userMetadata = data.user.user_metadata;
  const inviteTenantId = userMetadata?.tenant_id;
  const inviteRole = userMetadata?.role;

  console.log('[Auth Callback] User authenticated:', {
    userId: data.user.id,
    email: data.user.email,
    hasInviteData: !!(inviteTenantId && inviteRole),
    tenantName: userMetadata?.tenant_name,
    redirect: redirect,
  });

  // Clear any stale invite metadata to prevent redirect loops
  // Invite handling is done via specific invite links, not via metadata on normal login
  if (inviteTenantId && inviteRole) {
    console.log('[Auth Callback] Clearing stale invite metadata from user profile');
    try {
      const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
      );
      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { tenant_id: null, role: null, tenant_name: null, tenant_subdomain: null, invited_by_name: null }
      });
    } catch (e) {
      console.log('[Auth Callback] Failed to clear invite metadata:', e);
      // Don't fail the auth flow if clearing metadata fails
    }
  }

  // We have a valid session. Pass tokens via URL fragment to the oauth-login
  // page which will sync them into localStorage. We avoid a database query here
  // because the Supabase client may not be fully authenticated in all browsers
  // (e.g. Firefox Total Cookie Protection can interfere with the PKCE verifier
  // cookie, causing RLS-protected queries to fail silently).
  // The oauth-login page calls /api/auth/me (backend, service-role) which
  // handles tenant lookup and will redirect to login if the account is invalid.
  const accessToken = data.session?.access_token;
  const refreshToken = data.session?.refresh_token;

  if (!accessToken) {
    console.error('[Auth Callback] No access token in session');
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  console.log('[Auth Callback] Session obtained, passing tokens via URL fragment to oauth-login');

  // URL fragments never leave the browser — not sent to servers, not logged,
  // and unaffected by cross-site cookie restrictions.
  const payload = Buffer.from(JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    redirect,
  })).toString('base64url');

  // Determine if the redirect target is on a different domain (subdomain sync)
  let targetOrigin = origin;
  if (redirect.startsWith('http')) {
    try {
      const redirectUrl = new URL(redirect);
      targetOrigin = redirectUrl.origin;
      console.log('[Auth Callback] Absolute redirect detected, targeting origin:', targetOrigin);
    } catch (e) {
      console.error('[Auth Callback] Failed to parse absolute redirect URL:', e);
    }
  }

  return NextResponse.redirect(`${targetOrigin}/auth/oauth-login#t=${payload}`);
}
