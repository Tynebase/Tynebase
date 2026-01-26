"use client";

import { Sparkles, Zap, Shield, Bug } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

const releases = [
  {
    version: "1.4.0",
    date: "January 10, 2026",
    type: "feature",
    title: "AI Document Generation",
    description: "Generate complete documentation from prompts, videos, or screenshots using our new AI assistant.",
    changes: [
      "New AI-powered document generation",
      "Video-to-documentation converter",
      "Screenshot analysis for auto-docs",
      "EU-compliant AI processing"
    ]
  },
  {
    version: "1.3.2",
    date: "January 5, 2026",
    type: "improvement",
    title: "Performance Improvements",
    description: "Major performance optimizations across the platform.",
    changes: [
      "50% faster document loading",
      "Improved search indexing",
      "Optimized real-time collaboration",
      "Reduced memory usage"
    ]
  },
  {
    version: "1.3.1",
    date: "December 28, 2025",
    type: "security",
    title: "Security Update",
    description: "Important security enhancements and compliance updates.",
    changes: [
      "SOC2 Type II certification",
      "Enhanced SSO configuration",
      "Improved audit logging",
      "SCIM provisioning support"
    ]
  },
  {
    version: "1.3.0",
    date: "December 20, 2025",
    type: "feature",
    title: "White-Label Branding",
    description: "Full white-label support for enterprise customers.",
    changes: [
      "Custom domain support",
      "Brand color customization",
      "Logo upload for light/dark modes",
      "Custom email templates"
    ]
  },
  {
    version: "1.2.5",
    date: "December 15, 2025",
    type: "fix",
    title: "Bug Fixes",
    description: "Various bug fixes and stability improvements.",
    changes: [
      "Fixed document sync issues",
      "Resolved search ranking bugs",
      "Fixed mobile navigation",
      "Improved error handling"
    ]
  }
];

const typeIcons = {
  feature: Sparkles,
  improvement: Zap,
  security: Shield,
  fix: Bug
};

const typeColors = {
  feature: "brand",
  improvement: "blue",
  security: "purple",
  fix: "pink"
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />
      <div className="grid-overlay" />

      <SiteNavbar currentPage="other" />

      <section className="section pt-[180px] pb-[80px]">
        <div className="container text-center">
          <p className="text-sm font-semibold text-[var(--brand)] uppercase tracking-wider mb-4">Changelog</p>
          <h1 className="text-5xl sm:text-6xl font-semibold text-[var(--text-primary)] leading-[1.05] tracking-[-0.02em] mb-6">
            What's new
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-[600px] mx-auto">
            The latest updates, improvements, and fixes to TyneBase.
          </p>
        </div>
      </section>

      <section className="section py-16">
        <div className="container">
          <div className="max-w-3xl mx-auto space-y-8">
            {releases.map((release) => {
              const Icon = typeIcons[release.type as keyof typeof typeIcons];
              return (
                <div key={release.version} className="bento-item">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`feature-icon feature-icon-${typeColors[release.type as keyof typeof typeColors]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-mono text-[var(--brand)]">v{release.version}</span>
                        <span className="text-sm text-[var(--text-muted)]">{release.date}</span>
                      </div>
                      <h3 className="text-xl font-semibold text-[var(--text-primary)]">{release.title}</h3>
                    </div>
                  </div>
                  <p className="text-[var(--text-secondary)] mb-4">{release.description}</p>
                  <ul className="space-y-2">
                    {release.changes.map((change, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <SiteFooter currentPage="changelog" />
    </div>
  );
}
