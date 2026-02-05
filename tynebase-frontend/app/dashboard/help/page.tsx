"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, BookOpen, MessageSquare, Video, Mail,
  FileText, Sparkles, Users, Shield, Zap
} from "lucide-react";

const helpCategories = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics of TyneBase",
    icon: Zap,
    color: "#10b981",
    articles: [
      { title: "Quick start Guide", href: "#" },
      { title: "Creating Your First Document", href: "#" },
      { title: "Understanding the Dashboard", href: "#" },
      { title: "Inviting Team Members", href: "#" },
    ],
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    description: "Manage your documentation",
    icon: BookOpen,
    color: "#3b82f6",
    articles: [
      { title: "Organizing Articles", href: "#" },
      { title: "Using Categories & Tags", href: "#" },
      { title: "Version History", href: "#" },
      { title: "Publishing & Unpublishing", href: "#" },
    ],
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    description: "Generate content with AI",
    icon: Sparkles,
    color: "#8b5cf6",
    articles: [
      { title: "Generating from Prompts", href: "#" },
      { title: "Automatically transform videos into comprehensive documentation", href: "#" },
      { title: "Enhancing Existing Content", href: "#" },
      { title: "AI Settings & Providers", href: "#" },
    ],
  },
  {
    id: "community",
    title: "Community & Forums",
    description: "Collaborate with your team",
    icon: Users,
    color: "#f59e0b",
    articles: [
      { title: "Creating Discussions", href: "#" },
      { title: "Moderation Tools", href: "#" },
      { title: "Mentions & Notifications", href: "#" },
      { title: "Best Practices", href: "#" },
    ],
  },
  {
    id: "templates",
    title: "Templates",
    description: "Use and create templates",
    icon: FileText,
    color: "#ef4444",
    articles: [
      { title: "Using Templates", href: "#" },
      { title: "Creating Custom Templates", href: "#" },
      { title: "Sharing Templates", href: "#" },
      { title: "Template Variables", href: "#" },
    ],
  },
  {
    id: "admin",
    title: "Administration",
    description: "Manage your workspace",
    icon: Shield,
    color: "#06b6d4",
    articles: [
      { title: "User Management", href: "#" },
      { title: "Roles & Permissions", href: "#" },
      { title: "Branding & White-Label", href: "#" },
      { title: "Billing & Plans", href: "#" },
    ],
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-8">
      {/* Header */}
      <div className="text-center py-6 sm:py-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--dash-text-primary)] tracking-tight">Help Center</h1>
        <p className="text-[var(--dash-text-tertiary)] mt-3 text-lg max-w-2xl mx-auto px-4">
          Find answers, guides, and support for TyneBase
        </p>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-0">
        <div className="relative group z-10">
          <div className="absolute inset-0 bg-[var(--brand)]/20 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--dash-text-muted)]" />
            <input
              type="text"
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 text-lg transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
        <Link
          href="/dashboard/community"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-secondary)] font-medium hover:border-[var(--brand)] hover:text-[var(--brand)] hover:shadow-md transition-all"
        >
          <MessageSquare className="w-5 h-5" />
          Ask Community
        </Link>
        <a
          href="mailto:support@tynebase.com"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-secondary)] font-medium hover:border-[var(--brand)] hover:text-[var(--brand)] hover:shadow-md transition-all"
        >
          <Mail className="w-5 h-5" />
          Contact Support
        </a>
        <a
          href="#"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-secondary)] font-medium hover:border-[var(--brand)] hover:text-[var(--brand)] hover:shadow-md transition-all"
        >
          <Video className="w-5 h-5" />
          Video Tutorials
        </a>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-0">
        {helpCategories.map((category) => (
          <div
            key={category.id}
            className="group bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl p-6 hover:shadow-xl hover:border-[var(--brand)]/30 transition-all duration-300 relative overflow-hidden"
          >
            <div className="relative">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-sm"
                style={{ backgroundColor: `${category.color}15`, color: category.color }}
              >
                <category.icon className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-[var(--dash-text-primary)] group-hover:text-[var(--brand)] transition-colors">
                {category.title}
              </h3>
              <p className="text-sm text-[var(--dash-text-tertiary)] mt-1 mb-4">
                {category.description}
              </p>

              <div className="space-y-1">
                {category.articles.map((article) => (
                  <Link
                    key={article.title}
                    href={article.href}
                    className="block py-1.5 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--brand)] hover:translate-x-1 transition-all"
                  >
                    {article.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Contact */}
      <div className="px-4 sm:px-0 pb-10">
        <div className="bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] rounded-3xl p-8 sm:p-12 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-white/5 opacity-50 backdrop-blur-3xl" />
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Still need help?</h2>
            <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
              Our support team is here to assist you with any questions or issues you might have.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="mailto:support@tynebase.com"
                style={{ backgroundColor: "#ffffff", color: "#000000" }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold hover:bg-zinc-50 hover:scale-105 transition-all shadow-lg"
              >
                <Mail className="w-5 h-5" />
                Email Support
              </a>
              <Link
                href="/dashboard/community"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 text-white border border-white/20 rounded-xl font-bold hover:bg-white/20 transition-all backdrop-blur-sm"
              >
                <MessageSquare className="w-5 h-5" />
                Community Forum
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}
