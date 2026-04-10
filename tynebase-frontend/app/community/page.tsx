"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Users, BookOpen, ArrowRight, Lock, TrendingUp, HelpCircle, Bell, Shield, Loader2, Calendar } from "lucide-react";
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
  const { user } = useAuth();
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
            const discussionsRes = await listPublicDiscussions(tenantData.subdomain, { limit: 5 });
            setDiscussions(discussionsRes.discussions || []);
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
          </div>
        </header>
      )}

      <section className="section pt-[180px] pb-[80px]">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ marginBottom: '24px' }}>
            {tenant?.branding?.logo_url ? (
               <img src={tenant.branding.logo_url} alt={companyName} style={{ height: "80px", width: "auto", objectFit: "contain" }} />
            ) : (
              <img 
                src="/comunity_logo3.webp"
                alt="Community" 
                style={{ 
                  width: '80px', 
                  height: '80px', 
                  objectFit: 'contain' 
                }} 
              />
            )}
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: primaryColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Community</p>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.75rem)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '24px', textAlign: 'center' }}>
            {tenant ? `${companyName} Community` : "Join the conversation"}
          </h1>
          <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '700px', textAlign: 'center', marginBottom: '24px' }}>
            {tenant 
              ? `Connect with other ${companyName} users, share knowledge and get help from our branded community.`
              : "Connect with other TyneBase users, share knowledge and get help from our vibrant community."}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '40px' }}>
            <Lock className="w-4 h-4" />
            <span>Members-only access • Sign up to join</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link href="/community/signup" className="btn btn-primary btn-lg">
              Become a Member
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/community/login" className="btn btn-secondary btn-lg">
              Log in to Community
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Discussions or Bento Stats */}
      <section className="section py-16">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ width: '100%', maxWidth: '1152px' }}>
            {discussions.length > 0 ? (
               <div style={{ marginBottom: "64px" }}>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                   <h2 style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)" }}>Recent Discussions</h2>
                   <Link href="/community/signup" className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>View all topics</Link>
                 </div>
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
                        <Link href="/community/signup" className="btn btn-ghost btn-sm" style={{ border: "1px solid var(--border-subtle)" }}>Read More</Link>
                     </div>
                   ))}
                 </div>
               </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bento-item text-center">
                <div className="feature-icon feature-icon-brand mx-auto mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Active Members</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">Join thousands of knowledge workers</p>
                <p className="text-3xl font-bold text-[var(--brand)]">2,500+</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">and growing daily</p>
              </div>
              <div className="bento-item text-center">
                <div className="feature-icon feature-icon-blue mx-auto mb-4">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Discussions</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">In-depth conversations and Q&A</p>
                <p className="text-3xl font-bold text-[var(--accent-blue)]">5,000+</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">topics covered</p>
              </div>
              <div className="bento-item text-center">
                <div className="feature-icon feature-icon-purple mx-auto mb-4">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Resources</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">Community-created guides & templates</p>
                <p className="text-3xl font-bold text-[var(--accent-purple)]">200+</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">shared resources</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="section py-16 bg-[var(--bg-secondary)]">
        <div className="container px-6">
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>What you get as a member</h2>
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '700px', margin: '0 auto' }}>
              Access exclusive community features and connect with fellow {companyName} users
            </p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
              <div className="bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-6 text-center shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="feature-icon feature-icon-brand">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Discussion Forums</h3>
                <p className="text-sm text-[var(--text-secondary)]">Ask questions, share insights and engage in threaded discussions with the community</p>
              </div>

              <div className="bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-6 text-center shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="feature-icon feature-icon-blue">
                    <Bell className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Product Updates</h3>
                <p className="text-sm text-[var(--text-secondary)]">Be the first to know about new features, updates and announcements</p>
              </div>

              <div className="bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-6 text-center shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="feature-icon feature-icon-purple">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">Feature Requests</h3>
                <p className="text-sm text-[var(--text-secondary)]">Vote on and suggest new features to shape the future of TyneBase</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="section py-24">
          <div className="container px-6">
            <div className="relative group">
              <div 
                className="absolute -inset-1 rounded-[32px] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"
                style={{ background: `linear-gradient(to right, ${primaryColor}, #3b82f6)` }}
              />
              <div className="relative bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-[32px] p-12 text-center shadow-2xl overflow-hidden">
                <div 
                  className="absolute top-0 right-0 w-64 h-64 opacity-5 pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`, transform: 'translate(30%, -30%)' }}
                />
                
                <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-6">Want to join the conversation?</h2>
                <p className="text-[var(--text-secondary)] text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
                  Connect with experts, share your knowledge, and help grow the {companyName} knowledge hub.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                  <Link
                    href="/community/signup"
                    className="w-full sm:w-auto px-10 py-4 bg-[var(--brand)] hover:brightness-110 text-white font-bold rounded-2xl transition-all shadow-xl shadow-[var(--brand)]/20 flex items-center justify-center gap-2 text-lg group/btn"
                  >
                    Join the Community 
                    <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/community/login"
                    className="w-full sm:w-auto px-10 py-4 bg-[var(--surface-subtle)] hover:bg-[var(--surface-tertiary)] text-[var(--text-primary)] font-bold rounded-2xl border border-[var(--border-subtle)] transition-all text-lg"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
