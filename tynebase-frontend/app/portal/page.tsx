"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function PortalContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/docs");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
      <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#E85002" }} />
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#E85002" }} />
      </div>
    }>
      <PortalContent />
    </Suspense>
  );
}
