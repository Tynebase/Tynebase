import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use new publishable key, fallback to old anon key for backward compatibility
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Return null if Supabase is not configured
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tynebase.com";
  // Always use leading dot for subdomains to share cookies between root and subdomains
  const cookieDomain = process.env.NODE_ENV === "production" ? `.${baseDomain}` : undefined;

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
      cookieOptions: {
        path: "/",
        domain: cookieDomain,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
