"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Users, BookOpen, ArrowRight, Lock, TrendingUp, HelpCircle, Bell, Shield, Loader2, Calendar, LogOut, User, Hash, Eye, ThumbsUp } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicDiscussions, Discussion } from "@/lib/api/discussions";

const iconMap: Record<string, any> = {
  Bell,
  HelpCircle,
  TrendingUp,
  MessageSquare,
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  count: number;
}

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

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
            // Fetch categories
            const categoriesRes = await fetch(`${baseUrl}/api/public/community/${tenantData.subdomain}/categories`);
            if (categoriesRes.ok) {
              const categoriesData = await categoriesRes.json();
              setCategories(categoriesData.data?.categories || []);
            }

            // Fetch tags
            const tagsRes = await fetch(`${baseUrl}/api/public/community/${tenantData.subdomain}/tags?limit=10`);
            if (tagsRes.ok) {
              const tagsData = await tagsRes.json();
              setTags(tagsData.data?.tags || []);
            }

            // Fetch discussions
            const discussionsRes = await listPublicDiscussions(tenantData.subdomain, { 
              limit: 5,
              category: activeCategory === "all" ? undefined : activeCategory
            }).catch(err => {
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
  }, [domain, activeCategory]);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
              <Link href="/docs" style={{ fontSize: '14px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>
                Documentation →
              </Link>
            </div>
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

      {/* Categories */}
      {tenant && categories.length > 0 && (
        <section style={{ position: 'relative', zIndex: 10, paddingTop: '32px', paddingBottom: '64px' }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" style={{ width: '100%', maxWidth: '1024px' }}>
              {/* All Discussions */}
              <Link
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveCategory('all'); }}
                className="bento-item cursor-pointer group block"
                style={{ opacity: activeCategory === 'all' ? 1 : 0.6 }}
              >
                <div className="feature-icon feature-icon-brand mb-4">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--brand)] transition-colors">
                  All Discussions
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-3">Browse all community discussions</p>
                <p className="text-xs text-[var(--text-muted)]">{discussions.length} discussions</p>
              </Link>
              
              {/* Dynamic Categories */}
              {categories.map((cat: Category) => {
                const Icon = iconMap[cat.icon] || MessageSquare;
                return (
                  <Link
                    key={cat.id}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveCategory(cat.id); }}
                    className="bento-item cursor-pointer group block"
                    style={{ opacity: activeCategory === cat.id ? 1 : 0.6 }}
                  >
                    <div className="feature-icon feature-icon-brand mb-4" style={{ color: cat.color }}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--brand)] transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-3">{cat.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">{cat.count} discussions</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tags */}
      {tenant && tags.length > 0 && (
        <section style={{ position: 'relative', zIndex: 10, paddingTop: '32px', paddingBottom: '32px' }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
            <div style={{ width: '100%', maxWidth: '1024px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>Popular Tags</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tags.map((tag) => (
                  <Link
                    key={tag.name}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                      e.currentTarget.style.borderColor = 'var(--brand)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface-subtle)';
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    {tag.name}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>{tag.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Discussions */}
      <section className="section py-8">
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
                  <Link
                    key={d.id}
                    href={`/community/${d.id}`}
                    className="bento-item block"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", textDecoration: "none", cursor: "pointer" }}
                  >
                     <div style={{ display: "flex", gap: "16px" }}>
                        <div className="feature-icon feature-icon-brand" style={{ flexShrink: 0 }}>
                           <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                           <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{d.title}</h3>
                           <div style={{ display: "flex", gap: "12px", fontSize: "14px", color: "var(--text-muted)" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Users className="w-3.5 h-3.5" /> {d.author?.full_name || 'Member'}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Calendar className="w-3.5 h-3.5" /> {formatTimeAgo(d.created_at)}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><MessageSquare className="w-3.5 h-3.5" /> {d.replies_count}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Eye className="w-3.5 h-3.5" /> {d.views_count || 0}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><ThumbsUp className="w-3.5 h-3.5" /> {d.likes_count || 0}</span>
                           </div>
                        </div>
                     </div>
                     <div className="btn btn-ghost btn-sm" style={{ border: "1px solid var(--border-subtle)", pointerEvents: "none" }}>Read More</div>
                  </Link>
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
