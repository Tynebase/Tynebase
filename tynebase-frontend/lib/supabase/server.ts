import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  // Use new publishable key, fallback to old anon key for backward compatibility
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tynebase.com";
  const cookieDomain = process.env.NODE_ENV === "production" ? `.${baseDomain}` : undefined;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { 
                ...options,
                path: options.path || "/",
                domain: options.domain || cookieDomain,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
      cookieOptions: {
        path: "/",
        domain: cookieDomain,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    }
  );
}
