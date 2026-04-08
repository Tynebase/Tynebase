import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
  });

  if (inviteTenantId && inviteRole) {
    // This is an invited user - check if user record already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, tenant_id, status')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!existingUser) {
      // New user - redirect to accept-invite page to set name & password
      const inviteData = encodeURIComponent(JSON.stringify({
        userId: data.user.id,
        email: data.user.email,
        tenantId: inviteTenantId,
        tenantName: userMetadata?.tenant_name,
        tenantSubdomain: userMetadata?.tenant_subdomain,
        role: inviteRole,
        invitedBy: userMetadata?.invited_by_name,
      }));
      console.log('[Auth Callback] New invited user → accept-invite page');
      return NextResponse.redirect(`${origin}/auth/accept-invite?data=${inviteData}`);
    }

    // User record exists - they may have been moved to the new tenant already
    // (this happens when an existing user is invited and the backend moved them)
    console.log('[Auth Callback] Existing user with invite metadata, tenant_id:', existingUser.tenant_id);

    if (existingUser.status === 'deleted') {
      // User was previously deleted - redirect to login with message
      return NextResponse.redirect(
        `${origin}/login?error=account_deleted&message=${encodeURIComponent('Your account has been removed. You can create a new workspace or wait to be invited again.')}`
      );
    }
  }

  // Fetch user's tenant context for redirect
  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, status, tenants!inner(subdomain)')
    .eq('id', data.user.id)
    .maybeSingle();

  if (userData?.status === 'deleted') {
    return NextResponse.redirect(
      `${origin}/login?error=account_deleted&message=${encodeURIComponent('Your account has been removed from this workspace.')}`
    );
  }

  if (userData?.tenant_id && userData.tenants && typeof userData.tenants === 'object' && 'subdomain' in userData.tenants) {
    const subdomain = (userData.tenants as { subdomain: string }).subdomain;
    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;

    console.log('[Auth Callback] User has tenant, passing tokens via URL fragment to oauth-login');

    // Pass tokens via URL fragment — fragments never leave the browser so they
    // aren't affected by Firefox Total Cookie Protection or cross-site cookie
    // restrictions that apply to Set-Cookie headers in redirect responses.
    const payload = Buffer.from(JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      tenant_subdomain: subdomain,
      redirect,
    })).toString('base64url');

    return NextResponse.redirect(`${origin}/auth/oauth-login#t=${payload}`);
  }

  // User exists in auth but has no tenant record - might need to complete signup
  console.log('[Auth Callback] User has no tenant record, redirecting to dashboard');
  return NextResponse.redirect(`${origin}/dashboard`);
}
