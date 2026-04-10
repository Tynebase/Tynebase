"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Users, BookOpen, ArrowRight, Lock, TrendingUp, HelpCircle, Bell, Shield, Loader2, Calendar, LogOut, User } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicDiscussions, Discussion } from "@/lib/api/discussions";

interface TenantInfo {
  id: string;
  subdomain: string;
  name: string;
  branding: {
    primary_color?: string;
    company_name?: string;
    logo_url?: string;
  };
}

function CommunityContent() {
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();
  // Use domain from search params (set by middleware) or fallback to current hostname
  const domain = searchParams.get("domain") || (typeof window !== 'undefined' ? window.location.hostname : null);

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!domain) return;

    async function fetchData() {
      try {
        setLoading(true);
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/public/tenant-by-domain?domain=${encodeURIComponent(domain!)}`);
        if (res.ok) {
          const data = await res.json();
          const tenantData = data.data?.tenant || null;
          setTenant(tenantData);

          if (tenantData?.subdomain) {
            const discussionsRes = await listPublicDiscussions(tenantData.subdomain, { limit: 5 }).catch(err => {
              console.error("[Community] Failed to fetch discussions:", err);
              return null;
            });
            setDiscussions(discussionsRes?.discussions || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch community data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [domain]);

  useEffect(() => {
    if (tenant?.branding?.primary_color) {
      document.documentElement.style.setProperty("--brand", tenant.branding.primary_color);
      document.documentElement.style.setProperty("--brand-primary", tenant.branding.primary_color);
    }
    return () => {
      document.documentElement.style.removeProperty("--brand");
      document.documentElement.style.removeProperty("--brand-primary");
    };
  }, [tenant]);

  const companyName = tenant?.branding?.company_name || tenant?.name || "Community";
  const primaryColor = tenant?.branding?.primary_color || "var(--brand)";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#E85002" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      {!tenant && <SiteNavbar currentPage="other" />}
      
      {tenant && (
        <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(10,10,15,0.8)' }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', maxWidth: '1200px', margin: '0 auto' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              {tenant.branding.logo_url ? (
                <img src={tenant.branding.logo_url} alt={companyName} style={{ height: '32px', width: 'auto' }} />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px', background: primaryColor }}>
                  {companyName.charAt(0)}
                </div>
              )}
              <div>
                <h1 style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1.2 }}>{companyName}</h1>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Community Hub</p>
              </div>
            </Link>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{user.email}</span>
                </div>
                <button
                  onClick={signOut}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'var(--surface-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface-tertiary)'}
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <section className="section pt-[120px] pb-[60px]">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ marginBottom: '24px' }}>
            {tenant?.branding.logo_url ? (
               <img src={tenant.branding.logo_url} alt={companyName} style={{ height: "64px", width: "auto", objectFit: "contain" }} />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '24px', background: primaryColor }}>
                {companyName.charAt(0)}
              </div>
            )}
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '16px', textAlign: 'center' }}>
            {companyName} Community
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '600px', textAlign: 'center', marginBottom: '32px' }}>
            Connect, share knowledge, and collaborate with other {companyName} users
          </p>
          {!user && (
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/community/login" className="btn btn-primary">
                Sign In
              </Link>
              <Link href="/community/signup" className="btn btn-secondary">
                Join Community
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Recent Discussions */}
      <section className="section py-16">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ width: '100%', maxWidth: '1152px' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
              <h2 style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)" }}>Recent Discussions</h2>
              {user && (
                <Link href="/dashboard/community" className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>View all topics</Link>
              )}
            </div>
            {discussions.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {discussions.map((d) => (
                  <div key={d.id} className="bento-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px" }}>
                     <div style={{ display: "flex", gap: "16px" }}>
                        <div className="feature-icon feature-icon-brand" style={{ flexShrink: 0 }}>
                           <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                           <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{d.title}</h3>
                           <div style={{ display: "flex", gap: "12px", fontSize: "14px", color: "var(--text-muted)" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Users className="w-3.5 h-3.5" /> {d.author?.full_name || 'Member'}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Calendar className="w-3.5 h-3.5" /> {new Date(d.created_at).toLocaleDateString()}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><MessageSquare className="w-3.5 h-3.5" /> {d.replies_count} replies</span>
                           </div>
                        </div>
                     </div>
                     {user ? (
                       <Link href={`/dashboard/community/${d.id}`} className="btn btn-ghost btn-sm" style={{ border: "1px solid var(--border-subtle)" }}>Read More</Link>
                     ) : (
                       <Link href="/community/login" className="btn btn-ghost btn-sm" style={{ border: "1px solid var(--border-subtle)" }}>Read More</Link>
                     )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p style={{ fontSize: '18px', marginBottom: '8px' }}>No discussions yet</p>
                <p style={{ fontSize: '14px' }}>{user ? 'Be the first to start a conversation!' : 'Sign in to start a discussion'}</p>
              </div>
            )}
          </div>
        </div>
      </section>


      <SiteFooter currentPage="community" />
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#E85002" }} />
      </div>
    }>
      <CommunityContent />
    </Suspense>
  );
}
