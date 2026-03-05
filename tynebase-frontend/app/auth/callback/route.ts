import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tenant = searchParams.get("tenant");
  const redirect = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle Supabase error redirects (e.g., expired links)
  if (errorParam) {
    console.error('[Auth Callback] Supabase error:', errorParam, errorDescription);
    return NextResponse.redirect(`${origin}/login?error=${errorParam}&message=${encodeURIComponent(errorDescription || 'Authentication failed')}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('[Auth Callback] Session exchange error:', error.message);
      return NextResponse.redirect(`${origin}/login?error=session_error&message=${encodeURIComponent(error.message)}`);
    }
    
    if (data.user) {
      // Check if this is an invited user (has invite metadata)
      const userMetadata = data.user.user_metadata;
      const inviteTenantId = userMetadata?.tenant_id;
      const inviteRole = userMetadata?.role;
      
      console.log('[Auth Callback] User metadata:', { 
        userId: data.user.id, 
        email: data.user.email,
        inviteTenantId, 
        inviteRole,
        tenantName: userMetadata?.tenant_name 
      });
      
      if (inviteTenantId && inviteRole) {
        // This is an invited user - check if user record exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', data.user.id)
          .single();
        
        if (!existingUser) {
          // Redirect to accept-invite page to complete profile setup
          const inviteData = encodeURIComponent(JSON.stringify({
            userId: data.user.id,
            email: data.user.email,
            tenantId: inviteTenantId,
            tenantName: userMetadata?.tenant_name,
            tenantSubdomain: userMetadata?.tenant_subdomain,
            role: inviteRole,
            invitedBy: userMetadata?.invited_by_name,
          }));
          console.log('[Auth Callback] Redirecting to accept-invite for new invited user');
          return NextResponse.redirect(`${origin}/auth/accept-invite?data=${inviteData}`);
        } else {
          console.log('[Auth Callback] Invited user already exists in users table');
        }
      }
      
      // Fetch user's tenant context for proper redirect
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id, tenants!inner(subdomain)')
        .eq('id', data.user.id)
        .single();
      
      if (userData?.tenant_id && userData.tenants && typeof userData.tenants === 'object' && 'subdomain' in userData.tenants) {
        // User has tenant - redirect to dashboard on the current origin
        // (subdomain routing is handled by the frontend tenant context, not DNS)
        return NextResponse.redirect(`${origin}${redirect}`);
      } else {
        // Individual user without tenant - redirect to main site dashboard
        return NextResponse.redirect(`${origin}/dashboard`);
      }
    }
  }

  console.error('[Auth Callback] No code provided or unknown error');
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
