"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, BookOpen, MessageSquare, FileText, Users, Settings, Zap, Shield, Palette, CreditCard } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

const categories = [
  { 
    icon: BookOpen, 
    title: "Getting Started", 
    description: "Learn the basics of TyneBase", 
    count: 12,
    href: "/docs?slug=getting-started-tutorial"
  },
  { 
    icon: FileText, 
    title: "Documentation", 
    description: "Create and manage documents", 
    count: 24,
    href: "/docs?slug=document-lifecycle"
  },
  { 
    icon: Users, 
    title: "Team Management", 
    description: "Invite and manage team members", 
    count: 8,
    href: "/docs?slug=inviting-team"
  },
  { 
    icon: Zap, 
    title: "AI Features", 
    description: "Use AI to generate content", 
    count: 10,
    href: "/docs?slug=first-ai-generation"
  },
  { 
    icon: Palette, 
    title: "Branding & White-Label", 
    description: "Customise your workspace branding", 
    count: 6,
    href: "/docs?slug=branding-overview"
  },
  { 
    icon: CreditCard, 
    title: "Billing & Plans", 
    description: "Pricing plans and payment options", 
    count: 4,
    href: "/docs?slug=billing-overview"
  },
  { 
    icon: Shield, 
    title: "Security & Privacy", 
    description: "SSO, permissions, and compliance", 
    count: 18,
    href: "/docs?slug=permissions-rbac"
  }
];

const popularArticles = [
  { title: "How to create your first document", href: "/docs?slug=creating-first-document" },
  { title: "Inviting team members to your workspace", href: "/docs?slug=inviting-team" },
  { title: "Setting up SSO for your organization", href: "/docs?slug=workspace-setup" },
  { title: "Using AI to generate documentation", href: "/docs?slug=first-ai-generation" },
  { title: "Configuring custom branding", href: "/docs?slug=workspace-setup" },
  { title: "Understanding permissions and roles", href: "/docs?slug=permissions-rbac" }
];

export default function HelpPage() {
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      <section style={{ position: 'relative', zIndex: 10, paddingTop: '180px', paddingBottom: '24px' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <Image
              src="/docs_logo1.webp"
              alt="Documentation"
              width={80}
              height={80}
              style={{ width: '80px', height: '80px' }}
            />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Help Center</p>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.75rem)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '32px', textAlign: 'center' }}>
            How can we help?
          </h1>
          <div style={{ width: '100%', maxWidth: '700px' }}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Search for help articles..." 
                className="w-full pl-12 pr-4 py-4 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] text-lg"
              />
            </div>
          </div>
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 10, paddingTop: '32px', paddingBottom: '64px' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ width: '100%', maxWidth: '1024px' }}>
            {categories.map((category) => (
              <Link key={category.title} href={category.href} className="bento-item cursor-pointer group block">
                <div className="feature-icon feature-icon-brand mb-4">
                  <category.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--brand)] transition-colors">
                  {category.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-3">{category.description}</p>
                <p className="text-xs text-[var(--text-muted)]">{category.count} articles</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section py-16 bg-[var(--bg-secondary)]">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-8 text-center">Popular Articles</h2>
            <div className="space-y-3">
              {popularArticles.map((article) => (
                <Link key={article.title} href={article.href} className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-4 cursor-pointer hover:border-[var(--brand)] transition-colors block">
                  <span className="text-[var(--text-primary)]">{article.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section py-16">
        <div className="container text-center">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Still need help?</h2>
          <p className="text-[var(--text-secondary)] mb-6">Our support team is here to assist you.</p>
          <Link href="/contact" className="btn btn-primary">
            <MessageSquare className="w-4 h-4" />
            Contact Support
          </Link>
        </div>
      </section>

      <SiteFooter currentPage="help" />
    </div>
  );
}
