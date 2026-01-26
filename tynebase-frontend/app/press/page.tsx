"use client";

import Image from "next/image";
import { Download, Mail } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function PressPage() {
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />
      <div className="grid-overlay" />

      <SiteNavbar currentPage="other" />

      <section className="section pt-[180px] pb-[80px]">
        <div className="container text-center">
          <p className="text-sm font-semibold text-[var(--brand)] uppercase tracking-wider mb-4">Press Kit</p>
          <h1 className="text-5xl sm:text-6xl font-semibold text-[var(--text-primary)] leading-[1.05] tracking-[-0.02em] mb-6">
            Media Resources
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-[600px] mx-auto">
            Download our brand assets and find information for press inquiries.
          </p>
        </div>
      </section>

      <section className="section py-16">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-8">Brand Assets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bento-item">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">Logos</h3>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-8 mb-4 flex items-center justify-center">
                  <Image src="/logo.png" alt="TyneBase Logo" width={200} height={50} className="h-12 w-auto" />
                </div>
                <button className="btn btn-secondary w-full">
                  <Download className="w-4 h-4" />
                  Download Logo Pack
                </button>
              </div>
              <div className="bento-item">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">Brand Colors</h3>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--brand)]" />
                    <div>
                      <p className="text-sm font-mono text-[var(--text-primary)]">#FF4D00</p>
                      <p className="text-xs text-[var(--text-muted)]">Brand Orange</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--gray-950)]" />
                    <div>
                      <p className="text-sm font-mono text-[var(--text-primary)]">#09090B</p>
                      <p className="text-xs text-[var(--text-muted)]">Primary Black</p>
                    </div>
                  </div>
                </div>
                <button className="btn btn-secondary w-full">
                  <Download className="w-4 h-4" />
                  Download Brand Guide
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section py-16 bg-[var(--bg-secondary)]">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-8">About TyneBase</h2>
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6">
              <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
                TyneBase is an AI-native knowledge management platform that helps teams build, share, and discover knowledge effortlessly. Founded in 2024 and headquartered in London, TyneBase serves thousands of teams worldwide with its privacy-first, EU-compliant platform.
              </p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                With features including AI-powered documentation, semantic search, real-time collaboration, and white-label branding, TyneBase is transforming how organizations manage and share knowledge.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section py-16">
        <div className="container text-center">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Press Inquiries</h2>
          <p className="text-[var(--text-secondary)] mb-6">For media inquiries, please contact our press team.</p>
          <a href="mailto:press@tynebase.com" className="btn btn-primary">
            <Mail className="w-4 h-4" />
            press@tynebase.com
          </a>
        </div>
      </section>

      <SiteFooter currentPage="press" />
    </div>
  );
}
