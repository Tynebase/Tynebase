"use client";

import Link from "next/link";
import Image from "next/image";
import { Users, FileText, BookOpen, Shield, ArrowRight } from "lucide-react";

const features = [
  { icon: Users, title: "Employee Handbook", description: "Company policies in one place" },
  { icon: FileText, title: "Onboarding Docs", description: "Streamline new hire onboarding" },
  { icon: BookOpen, title: "Benefits Guide", description: "Self-service benefits information" },
  { icon: Shield, title: "Policy Management", description: "Keep policies current and accessible" }
];

export default function HumanResourcesPage() {
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />
      <div className="grid-overlay" />

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
          <p className="text-sm font-semibold text-[var(--brand)] uppercase tracking-wider mb-4">Solutions</p>
          <h1 className="text-5xl sm:text-6xl font-semibold text-[var(--text-primary)] leading-[1.05] tracking-[-0.02em] mb-6">
            Human Resources
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-[700px] mx-auto mb-10">
            Empower your HR team with centralized policies, streamlined onboarding, and self-service employee resources.
          </p>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <section className="section py-16">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {features.map((feature) => (
              <div key={feature.title} className="bento-item text-center">
                <div className="feature-icon feature-icon-brand mx-auto mb-4">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{feature.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section py-20">
        <div className="container text-center">
          <Link href="/signup" className="btn btn-primary btn-lg">
            Get Started
            <ArrowRight className="w-5 h-5" />
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
