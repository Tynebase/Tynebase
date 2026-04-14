"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setTenantSubdomain } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

function FinalizeContent() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const subdomain = searchParams.get("subdomain");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function finalize() {
      if (!subdomain) {
        setError("Missing subdomain information.");
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        if (!supabase) throw new Error("Supabase client not initialized.");

        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // No session - redirect to login
          router.replace(`/community/login?subdomain=${subdomain}&error=session_expired`);
          return;
        }

        const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${apiBase}/api/auth/community/finalize-oauth-join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            // Tell the backend which tenant we're joining, so downstream
            // /api/auth/me calls resolve to this community's membership row.
            "x-tenant-subdomain": subdomain,
          },
          body: JSON.stringify({ subdomain }),
        });

        const result = await res.json();
 
         if (!res.ok) {
           const code = result.error?.code;
           if (code === 'ALREADY_MEMBER_OTHER') {
             setError("Your TyneBase account is already associated with another workspace and cannot join this community. Please use a different email or log out of your other workspace.");
           } else {
             setError(result.error?.message || "Failed to join community.");
           }
         } else {
           // Success! Pin this subdomain as the active tenant so subsequent
           // /api/auth/me calls resolve to the community membership row,
           // then refresh auth state and redirect to the community hub.
           console.log('[Finalize Join] Success, pinning tenant and refreshing user...');
           setTenantSubdomain(subdomain);
           await refreshUser();
           window.location.replace("/community");
         }
       } catch (err: any) {
         console.error("[Finalize Join] Error:", err);
         setError("An unexpected error occurred. Please try again.");
       } finally {
         setLoading(false);
       }
    }

    finalize();
  }, [subdomain, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#E85002]" />
          <h1 className="text-xl font-semibold">Setting up your profile</h1>
          <p className="text-sm opacity-60">Please wait while we prepare your community access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white p-6">
        <div className="w-full max-w-md bg-[#13131a] border border-white/5 rounded-2xl p-8 text-center shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-6">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Unable to Join</h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            {error}
          </p>
          <div className="flex flex-col gap-3">
            <Link 
              href={`/community/signup?subdomain=${subdomain}`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#E85002] hover:bg-[#ff5d0a] text-white font-semibold rounded-xl transition-all"
            >
              Try another account
            </Link>
            <Link 
              href="/"
              className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Go back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function JoinFinalizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 animate-spin text-[#E85002]" />
      </div>
    }>
      <FinalizeContent />
    </Suspense>
  );
}
