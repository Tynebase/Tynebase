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
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return undefined;
          const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
          return v ? decodeURIComponent(v[2]) : undefined;
        },
        set(name: string, value: string, options: any) {
          if (typeof document === 'undefined') return;
          const maxAgeStr = options.maxAge ? `; max-age=${options.maxAge}` : '';
          const domainStr = cookieDomain ? `; domain=${cookieDomain}` : '';
          const secureStr = process.env.NODE_ENV === "production" ? '; secure' : '';
          const sameSiteStr = `; samesite=${options.sameSite || 'lax'}`;
          document.cookie = `${name}=${encodeURIComponent(value)}; path=${options.path || '/'}${domainStr}${maxAgeStr}${sameSiteStr}${secureStr}`;
        },
        remove(name: string, options: any) {
          if (typeof document === 'undefined') return;
          const domainStr = cookieDomain ? `; domain=${cookieDomain}` : '';
          document.cookie = `${name}=; path=${options.path || '/'}${domainStr}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
      }
    }
  );
}
