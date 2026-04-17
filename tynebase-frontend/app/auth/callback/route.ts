import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * OAuth callback — stateless by design.
 *
 * Responsibilities (and only these):
 *   1. Surface Supabase-side OAuth errors back to /login with a friendly message.
 *   2. Exchange the PKCE `code` for a Supabase session.
 *   3. Hand the resulting access/refresh tokens to the next page via a URL
 *      fragment, so Firefox Total Cookie Protection and other cross-site
 *      cookie restrictions can't eat them.
 *
 * What this route intentionally does NOT do:
 *   - It does not query the `users` table.
 *   - It does not touch `user_metadata`.
 *   - It does not decide whether the user is new, invited, or a community
 *     joiner. That's each landing page's job:
 *       - /auth/oauth-login           → normal dashboard sign-in
 *       - /auth/accept-invite         → workspace invite acceptance
 *       - /community/join/finalize    → community-contributor creation
 *
 * Any logic beyond these three bullets belongs in the downstream page, not
 * here. Keeping this route dumb is what stops the stale-metadata loops that
 * previously corrupted user records.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  // Supabase sends `type=recovery` for password reset links, `type=invite` for invites
  const type = searchParams.get("type");

  // 1. Supabase-side errors (expired links, user denied consent, etc.)
  if (errorParam) {
    console.error('[Auth Callback] Supabase error:', errorParam, errorDescription);

    const isExpired = errorDescription?.includes('expired') || errorParam === 'access_denied';
    if (isExpired) {
      return NextResponse.redirect(
        `${origin}/login?error=invite_expired&message=${encodeURIComponent('This link has expired. Please ask the workspace admin to resend the invite.')}`
      );
    }

    return NextResponse.redirect(
      `${origin}/login?error=${errorParam}&message=${encodeURIComponent(errorDescription || 'Authentication failed. Please try again.')}`
    );
  }

  if (!code) {
    console.error('[Auth Callback] No code provided');
    return NextResponse.redirect(
      `${origin}/login?error=auth_failed&message=${encodeURIComponent('No authentication code was received. Please try signing in again.')}`
    );
  }

  // 2. Exchange the PKCE code for a session.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[Auth Callback] Session exchange error:', error.message);

    if (error.message.includes('expired') || error.message.includes('invalid')) {
      return NextResponse.redirect(
        `${origin}/login?error=invite_expired&message=${encodeURIComponent('This link has expired. Please ask the workspace admin to resend the invite.')}`
      );
    }

    return NextResponse.redirect(
      `${origin}/login?error=session_error&message=${encodeURIComponent(error.message)}`
    );
  }

  const accessToken = data.session?.access_token;
  const refreshToken = data.session?.refresh_token;

  if (!accessToken || !refreshToken) {
    console.error('[Auth Callback] Session missing tokens');
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // 3a. Password recovery flow: route to update-password, not the dashboard
  if (type === 'recovery') {
    console.log('[Auth Callback] Password recovery — redirecting to update-password');
    const recoveryPayload = Buffer.from(
      JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        redirect: '/auth/update-password',
      })
    ).toString('base64url');
    return NextResponse.redirect(`${origin}/auth/oauth-login#t=${recoveryPayload}`);
  }

  // 3b. Normal flow: pass tokens to /auth/oauth-login via a URL fragment. Fragments are
  //    never sent to servers, never logged, and are unaffected by cross-site
  //    cookie restrictions — this is our Firefox TCP workaround.
  const payload = Buffer.from(
    JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      redirect,
    })
  ).toString('base64url');

  // If the downstream `redirect` is an absolute URL on a different host
  // (subdomain sync), land oauth-login on that host so localStorage is
  // seeded where the user will actually use it.
  let targetOrigin = origin;
  if (redirect.startsWith('http')) {
    try {
      targetOrigin = new URL(redirect).origin;
    } catch (e) {
      console.error('[Auth Callback] Failed to parse absolute redirect URL:', e);
    }
  }

  console.log('[Auth Callback] Exchange complete, handing off to /auth/oauth-login', { targetOrigin, redirect });

  return NextResponse.redirect(`${targetOrigin}/auth/oauth-login#t=${payload}`);
}
