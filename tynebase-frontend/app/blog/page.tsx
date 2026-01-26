"use client";

import { Calendar, Clock, FileText } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

const posts = [
  {
    title: "Introducing TyneBase AI: Your Knowledge Assistant",
    excerpt: "We're excited to announce TyneBase AI, a powerful assistant that helps you create, find, and organise knowledge effortlessly.",
    date: "Jan 8, 2026",
    readTime: "5 min read",
    category: "Product",
    slug: "introducing-tynebase-ai"
  },
  {
    title: "Best Practices for Building a Company Knowledge Base",
    excerpt: "Learn how to structure your knowledge base for maximum discoverability and team adoption.",
    date: "Jan 5, 2026",
    readTime: "8 min read",
    category: "Guide",
    slug: "best-practices-knowledge-base"
  },
  {
    title: "How We Built a GDPR-Compliant AI Platform",
    excerpt: "A deep dive into our EU-first approach to AI and data privacy.",
    date: "Dec 28, 2025",
    readTime: "10 min read",
    category: "Engineering",
    slug: "gdpr-compliant-ai"
  },
  {
    title: "The Future of Documentation: AI-Native Knowledge Management",
    excerpt: "Why traditional documentation tools are falling behind and what comes next.",
    date: "Dec 20, 2025",
    readTime: "6 min read",
    category: "Insights",
    slug: "future-of-documentation"
  },
  {
    title: "TyneBase vs. Traditional Wikis: A Comparison",
    excerpt: "How modern knowledge platforms differ from legacy wiki solutions.",
    date: "Dec 15, 2025",
    readTime: "7 min read",
    category: "Comparison",
    slug: "tynebase-vs-wikis"
  },
  {
    title: "5 Templates Every Engineering Team Needs",
    excerpt: "Essential documentation templates to improve your engineering team's productivity.",
    date: "Dec 10, 2025",
    readTime: "4 min read",
    category: "Templates",
    slug: "engineering-templates"
  }
];

export default function BlogPage() {
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      {/* Hero */}
      <section className="section pt-[180px] pb-[80px]">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--brand), var(--accent-pink))' }}>
              <FileText style={{ width: '32px', height: '32px', color: 'white' }} />
            </div>
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Blog</p>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.75rem)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '24px', textAlign: 'center' }}>
            Insights & Updates
          </h1>
          <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '600px', textAlign: 'center' }}>
            Product news, best practices and insights on knowledge management.
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="section py-16">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ width: '100%', maxWidth: '1152px' }}>
            {posts.map((post) => (
              <article key={post.slug} className="bento-item group cursor-pointer">
                <div className="mb-4">
                  <span className="flex items-center gap-2">
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)' }}></span>
                    <span className="text-xs font-medium text-[var(--brand)]">
                      {post.category}
                    </span>
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3 group-hover:text-[var(--brand)] transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {post.readTime}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="section py-20">
        <div className="container">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
              Subscribe to our newsletter
            </h2>
            <p className="text-[var(--text-secondary)] mb-12">
              Get the latest updates on product features and knowledge management tips.
            </p>
          </div>
          <div className="flex gap-3 justify-center px-6" style={{ marginTop: '48px' }}>
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="w-full max-w-sm py-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)]"
              style={{ paddingLeft: '24px', paddingRight: '16px' }}
            />
            <button className="btn btn-primary">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      <SiteFooter currentPage="blog" />
    </div>
  );
}
