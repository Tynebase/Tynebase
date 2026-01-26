import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Fetch user's tenant context for proper redirect
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id, tenants!inner(subdomain)')
        .eq('id', data.user.id)
        .single();
      
      if (userData?.tenant_id && userData.tenants && typeof userData.tenants === 'object' && 'subdomain' in userData.tenants) {
        // User has tenant - redirect to tenant subdomain
        const tenantSubdomain = (userData.tenants as { subdomain: string }).subdomain;
        return NextResponse.redirect(`http://${tenantSubdomain}.tynebase.com${redirect}`);
      } else {
        // Individual user without tenant - redirect to main site dashboard
        return NextResponse.redirect(`${origin}/dashboard`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
