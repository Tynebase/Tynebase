"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, Code, Users, Briefcase, HeadphonesIcon, Settings } from "lucide-react";

const categories = [
  { id: "all", name: "All Templates", icon: FileText },
  { id: "engineering", name: "Engineering", icon: Code },
  { id: "hr", name: "Human Resources", icon: Users },
  { id: "operations", name: "Operations", icon: Settings },
  { id: "sales", name: "Sales", icon: Briefcase },
  { id: "support", name: "Support", icon: HeadphonesIcon }
];

const templates = [
  { title: "API Documentation", category: "engineering", description: "Document your REST or GraphQL APIs with endpoints, parameters, and examples." },
  { title: "Architecture Decision Record", category: "engineering", description: "Track technical decisions with context, options, and rationale." },
  { title: "Runbook Template", category: "engineering", description: "Incident response procedures with step-by-step instructions." },
  { title: "Developer Onboarding", category: "engineering", description: "New developer setup guide with environment configuration." },
  { title: "Employee Handbook", category: "hr", description: "Company policies, procedures, and guidelines." },
  { title: "Benefits Guide", category: "hr", description: "Compensation, perks, and employee benefits documentation." },
  { title: "Performance Review", category: "hr", description: "Structured evaluation templates for team reviews." },
  { title: "Hiring Process", category: "hr", description: "Recruitment workflows and interview guides." },
  { title: "Process Documentation", category: "operations", description: "Standard operating procedures for business processes." },
  { title: "Vendor Management", category: "operations", description: "Supplier information and contract details." },
  { title: "Sales Playbook", category: "sales", description: "Winning strategies and best practices for sales teams." },
  { title: "Competitor Analysis", category: "sales", description: "Market intelligence and competitive positioning." },
  { title: "FAQ Template", category: "support", description: "Common questions and answers for customers." },
  { title: "Troubleshooting Guide", category: "support", description: "Issue resolution steps and debugging procedures." },
  { title: "Meeting Notes", category: "all", description: "Structured meeting notes with action items." },
  { title: "Project Brief", category: "all", description: "Project overview with goals, scope, and timeline." }
];

export default function TemplatesPage() {
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="TyneBase" width={140} height={36} className="h-9 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/features" className="btn btn-ghost">Features</Link>
            <Link href="/pricing" className="btn btn-ghost">Pricing</Link>
            <Link href="/help" className="btn btn-ghost">Documentation</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn btn-ghost">Log in</Link>
            <Link href="/signup" className="btn btn-primary">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="section pt-[180px] pb-[80px]">
        <div className="container text-center">
          <p className="text-sm font-semibold text-[var(--brand)] uppercase tracking-wider mb-4">Templates</p>
          <h1 className="text-5xl sm:text-6xl font-semibold text-[var(--text-primary)] leading-[1.05] tracking-[-0.02em] mb-6">
            Start with a <span className="text-gradient text-glow">template</span>
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-[600px] mx-auto">
            Pre-built templates to help you get started quickly. Customize them for your team's needs.
          </p>
        </div>
      </section>

      <section className="section py-8">
        <div className="container">
          <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
            {categories.map((cat) => (
              <button 
                key={cat.id} 
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${cat.id === 'all' ? 'bg-[var(--brand)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section py-16">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {templates.map((template) => (
              <div key={template.title} className="bento-item cursor-pointer group">
                <div className="w-full h-32 bg-[var(--bg-secondary)] rounded-lg mb-4 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-[var(--text-muted)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--brand)] transition-colors">
                  {template.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{template.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section py-20">
        <div className="container text-center">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Create your own templates</h2>
          <p className="text-[var(--text-secondary)] mb-6">Build custom templates for your team's unique workflows.</p>
          <Link href="/signup" className="btn btn-primary">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border-subtle)] py-12">
        <div className="container">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[var(--text-muted)]">© 2026 TyneBase. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Privacy</Link>
              <Link href="/terms" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
