"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquare, Code, FolderKanban, Import, Cloud, Palette, Video, Zap, ExternalLink, Search } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

const integrations = [
  { name: "Slack", category: "Communication", description: "Get notifications and search docs from Slack", icon: MessageSquare, color: "pink", popular: true },
  { name: "Microsoft Teams", category: "Communication", description: "Collaborate with Teams integration", icon: MessageSquare, color: "blue", popular: true },
  { name: "GitHub", category: "Development", description: "Sync documentation with your repos", icon: Code, color: "purple", popular: true },
  { name: "GitLab", category: "Development", description: "Connect your GitLab projects", icon: Code, color: "brand", popular: false },
  { name: "Jira", category: "Project Management", description: "Link docs to Jira issues", icon: FolderKanban, color: "blue", popular: true },
  { name: "Linear", category: "Project Management", description: "Integrate with Linear workflows", icon: FolderKanban, color: "purple", popular: false },
  { name: "Notion", category: "Import", description: "Import your Notion workspace", icon: Import, color: "brand", popular: true },
  { name: "Confluence", category: "Import", description: "Migrate from Confluence easily", icon: Import, color: "blue", popular: false },
  { name: "Google Drive", category: "Storage", description: "Embed and sync Google Docs", icon: Cloud, color: "cyan", popular: true },
  { name: "Figma", category: "Design", description: "Embed Figma designs in docs", icon: Palette, color: "pink", popular: true },
  { name: "Loom", category: "Video", description: "Embed Loom videos seamlessly", icon: Video, color: "purple", popular: false },
  { name: "Zapier", category: "Automation", description: "Connect to 5000+ apps", icon: Zap, color: "brand", popular: true }
];

const categories = [
  { id: "all", label: "All", icon: null },
  { id: "Communication", label: "Communication", icon: MessageSquare },
  { id: "Development", label: "Development", icon: Code },
  { id: "Project Management", label: "Projects", icon: FolderKanban },
  { id: "Import", label: "Import", icon: Import },
  { id: "Storage", label: "Storage", icon: Cloud },
  { id: "Design", label: "Design", icon: Palette },
  { id: "Video", label: "Video", icon: Video },
  { id: "Automation", label: "Automation", icon: Zap },
];

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIntegrations = integrations.filter(i => {
    const matchesCategory = activeCategory === "all" || i.category === activeCategory;
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         i.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const popularIntegrations = integrations.filter(i => i.popular);

  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      <section className="section pt-[180px] pb-[80px]">
        <div className="container text-center">
          <p className="text-sm font-semibold text-[var(--brand)] uppercase tracking-wider mb-6">Integrations</p>
          <h1 className="text-5xl sm:text-6xl font-semibold text-[var(--text-primary)] leading-[1.05] tracking-[-0.02em] mb-6">
            Connect your <span className="text-gradient text-glow">favorite tools</span>
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-[600px] mx-auto mb-10">
            TyneBase integrates with the tools you already use, making knowledge accessible everywhere.
          </p>
          
          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] text-lg"
            />
          </div>
        </div>
      </section>

      {/* Popular Integrations */}
      <section className="section py-12">
        <div className="container">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-8 text-center">Popular Integrations</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {popularIntegrations.map((integration) => (
              <div key={integration.name} className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 text-center hover:border-[var(--brand)] hover:shadow-lg transition-all cursor-pointer group">
                <div className={`w-12 h-12 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-3`}>
                  <integration.icon className={`w-6 h-6 text-[var(--brand)]`} />
                </div>
                <p className="font-medium text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">{integration.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="section py-8">
        <div className="container">
          <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
            {categories.map((cat) => (
              <button 
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  activeCategory === cat.id 
                    ? 'bg-[var(--brand)] text-white' 
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {cat.icon && <cat.icon className="w-4 h-4" />}
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* All Integrations */}
      <section className="section py-16">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {filteredIntegrations.map((integration) => (
              <div key={integration.name} className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-[var(--brand)] hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center`}>
                    <integration.icon className={`w-6 h-6 text-[var(--brand)]`} />
                  </div>
                  {integration.popular && (
                    <span className="px-2 py-1 text-xs font-medium bg-[var(--brand)]/10 text-[var(--brand)] rounded-full">Popular</span>
                  )}
                </div>
                <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{integration.category}</span>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mt-1 mb-2 group-hover:text-[var(--brand)] transition-colors">
                  {integration.name}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">{integration.description}</p>
                <div className="flex items-center gap-2 text-sm text-[var(--brand)]">
                  <span>Learn more</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section py-20">
        <div className="container">
          <div className="relative max-w-3xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-purple)] to-[var(--accent-pink)] opacity-20 blur-3xl rounded-3xl" />
            <div className="relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-10 text-center">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Need a custom integration?</h2>
              <p className="text-[var(--text-secondary)] mb-6">We offer custom integrations for enterprise customers.</p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/contact" className="btn btn-primary">
                  Contact Sales
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/docs" className="btn btn-secondary">
                  View API Docs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter currentPage="integrations" />
    </div>
  );
}
