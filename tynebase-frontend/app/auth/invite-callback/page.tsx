"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setAuthTokens } from "@/lib/api/client";
import { declineInvite } from "@/lib/api/invites";
import { Loader2 } from "lucide-react";

/**
 * Client-side invite callback page.
 *
 * Supabase invite links use the implicit grant flow, which puts tokens in
 * the URL hash fragment (#access_token=...&type=invite).  Hash fragments
 * are never sent to the server, so a Next.js Route Handler cannot read them.
 *
 * This page runs in the browser where `createBrowserClient` from
 * @supabase/ssr automatically detects hash fragments and establishes a
 * session via `onAuthStateChange`.
 */

async function handleDeclineInvite(inviteId: string) {
  try {
    await declineInvite(inviteId);
    window.location.href = "/login?message=" + encodeURIComponent(
      "You have declined the invitation. You can safely close this page."
    );
  } catch (error) {
    console.error('[InviteCallback] Failed to decline invite:', error);
    window.location.href = "/login?error=decline_failed&message=" + encodeURIComponent(
      "Failed to decline invitation. Please try again or contact support."
    );
  }
}
function InviteCallbackContent() {
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Debug: log what we received
    console.log('[InviteCallback] URL:', window.location.href);
    console.log('[InviteCallback] Hash:', window.location.hash);
    console.log('[InviteCallback] Search:', window.location.search);

    // Check for decline action first
    const action = searchParams.get("action");
    const inviteId = searchParams.get("invite_id") || searchParams.get("invite");
    
    if (action === "decline" && inviteId) {
      handleDeclineInvite(inviteId);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      console.error('[InviteCallback] Supabase client not configured');
      window.location.href = "/login?error=config_error";
      return;
    }

    /* ---------- 1. Handle Supabase-level errors ---------- */
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    if (errorParam) {
      const isExpired =
        errorDescription?.includes("expired") || errorParam === "access_denied";
      const msg = isExpired
        ? "This invitation link has expired. Please ask the workspace admin to resend the invite."
        : errorDescription || "Authentication failed. Please try again.";
      window.location.href = `/login?error=${
        isExpired ? "invite_expired" : errorParam
      }&message=${encodeURIComponent(msg)}`;
      return;
    }

    /* ---------- 2. Wait for session (hash-fragment or PKCE) ---------- */

    const hash = window.location.hash;
    const hasHashTokens = hash && hash.includes("access_token");
    const code = searchParams.get("code");

    let timeoutId: ReturnType<typeof setTimeout>;
    let settled = false;

    function settle(session: any) {
      if (settled) return false;
      settled = true;
      clearTimeout(timeoutId);
      handleUser(session);
      return true;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[InviteCallback] onAuthStateChange:', event, session?.user?.email);
      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || (!hasHashTokens && !code && event === "INITIAL_SESSION")) &&
        session?.user
      ) {
        settle(session);
      }
    });

    /* --- Explicitly consume hash-fragment tokens ---
     * createBrowserClient (@supabase/ssr) does NOT auto-detect hash fragments
     * the way the vanilla @supabase/auth-js client does.  We must parse and
     * call setSession ourselves. */
    if (hasHashTokens) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        console.log('[InviteCallback] Setting session from hash fragment tokens');
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
          if (error) {
            console.error('[InviteCallback] setSession error:', error.message);
            const isExpired = error.message.includes("expired") || error.message.includes("invalid");
            window.location.href = `/login?error=${isExpired ? "invite_expired" : "session_error"}&message=${encodeURIComponent(
              isExpired ? "This invitation link has expired. Please ask the workspace admin to resend the invite." : error.message
            )}`;
            return;
          }
          if (data.session?.user) {
            settle(data.session);
          }
        });
      }
    }

    // PKCE code exchange (server-side flow)
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          const isExpired =
            error.message.includes("expired") ||
            error.message.includes("invalid");
          const msg = isExpired
            ? "This link has expired. Please ask the workspace admin to resend the invite."
            : error.message;
          window.location.href = `/login?error=${
            isExpired ? "invite_expired" : "session_error"
          }&message=${encodeURIComponent(msg)}`;
          return;
        }
        if (data.session?.user) {
          settle(data.session);
        }
      });
    }

    // Timeout: if no session after 10 seconds, bail
    timeoutId = setTimeout(async () => {
      // One last attempt
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        settle(data.session);
        return;
      }
      if (settled) return;
      settled = true;
      window.location.href =
        "/login?error=auth_failed&message=" +
        encodeURIComponent(
          "No authentication code was received. Please try the invitation link again."
        );
    }, 10000);

    async function handleUser(session: {
      user: any;
      access_token: string;
      refresh_token: string;
    }) {
      const user = session.user;
      const inviteId = searchParams.get("invite");

      // Store tokens so the API client can use them
      setAuthTokens(session.access_token, session.refresh_token);

      if (inviteId) {
        window.location.href = `/auth/accept-invite?invite=${encodeURIComponent(inviteId)}`;
        return;
      }

      const meta = user.user_metadata || {};
      const inviteTenantId = meta.tenant_id;
      const inviteRole = meta.role;

      if (inviteTenantId && inviteRole) {
        // Redirect to the accept-invite page with all necessary data
        const inviteData = encodeURIComponent(
          JSON.stringify({
            userId: user.id,
            email: user.email,
            tenantId: inviteTenantId,
            tenantName: meta.tenant_name,
            tenantSubdomain: meta.tenant_subdomain,
            role: inviteRole,
            invitedBy: meta.invited_by_name,
          })
        );
        window.location.href = `/auth/accept-invite?data=${inviteData}`;
        return;
      }

      // No invite metadata — just go to dashboard
      window.location.href = "/dashboard";
    }

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)]">
      <Loader2 className="w-10 h-10 text-[var(--brand)] animate-spin mb-4" />
      <p className="text-[var(--text-secondary)] text-sm">
        Processing your invitation…
      </p>
    </div>
  );
}

export default function InviteCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <Loader2 className="w-8 h-8 text-[var(--brand)] animate-spin" />
        </div>
      }
    >
      <InviteCallbackContent />
    </Suspense>
  );
}
