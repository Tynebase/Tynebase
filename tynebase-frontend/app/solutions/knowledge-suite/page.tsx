"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Search, Users, Sparkles, ArrowRight, Check } from "lucide-react";

const features = [
  { icon: BookOpen, title: "Centralized Documentation", description: "All your team's knowledge in one searchable place" },
  { icon: Search, title: "AI-Powered Search", description: "Find answers instantly with semantic search" },
  { icon: Users, title: "Real-time Collaboration", description: "Work together on documents in real-time" },
  { icon: Sparkles, title: "AI Content Generation", description: "Generate documentation from prompts and videos" }
];

const benefits = [
  "Reduce time spent searching for information by 70%",
  "Onboard new team members 3x faster",
  "Keep documentation accurate with automated reminders",
  "Enable self-service knowledge discovery"
];

export default function KnowledgeSuitePage() {
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
            Knowledge Suite
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-[700px] mx-auto mb-10">
            Transform how your organization creates, organises, and discovers knowledge with TyneBase's complete knowledge management solution.
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

      <section className="section py-16 bg-[var(--bg-secondary)]">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-8 text-center">Why teams choose TyneBase</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-4">
                  <Check className="w-5 h-5 text-[var(--brand)] flex-shrink-0 mt-0.5" />
                  <span className="text-[var(--text-secondary)]">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section py-20">
        <div className="container">
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-purple)] to-[var(--accent-pink)] opacity-20 blur-3xl rounded-3xl" />
            <div className="relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-12 text-center">
              <h2 className="text-3xl font-semibold text-[var(--text-primary)] mb-4">Ready to transform your knowledge management?</h2>
              <p className="text-lg text-[var(--text-secondary)] mb-8">Start your free trial today. No credit card required.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup" className="btn btn-primary btn-lg">Start Free Trial</Link>
                <Link href="/contact" className="btn btn-secondary btn-lg">Talk to Sales</Link>
              </div>
            </div>
          </div>
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
