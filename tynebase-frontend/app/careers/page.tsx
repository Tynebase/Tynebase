"use client";

import { MapPin, Briefcase } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

const positions = [
  {
    title: "Document handling specialist",
    department: "Legal",
    location: "Remote (EU)",
    type: "Part-time, Possible full-time",
    slug: "document-handling"
  },
   {
    title: "Marketing specialist",
    department: "Marketing",
    location: "Remote (EU)",
    type: "Part-time",
    slug: "marketing-specialist"
  },
];

const benefits = [
  "Competitive salary + equity",
  "Remote-first culture",
  "Unlimited PTO",
  "Health & dental insurance",
  "Learning budget",
  "Home office setup",
  "Annual team retreats",
  "Flexible hours"
];

export default function CareersPage() {
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      <section className="section pt-[180px] pb-[80px]">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <img 
              src="/careers_logo.webp" 
              alt="Careers" 
              style={{ 
                width: '80px', 
                height: '80px', 
                objectFit: 'contain' 
              }} 
            />
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Careers</p>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3.75rem)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '24px', textAlign: 'center' }}>
            Join our <span className="text-gradient">mission</span>
          </h1>
          <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '600px', textAlign: 'center' }}>
            Help us build the future of knowledge management. We're looking for passionate people to join our team.
          </p>
        </div>
      </section>

      <section className="section py-16">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          <div style={{ width: '100%', maxWidth: '896px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '32px', textAlign: 'center' }}>Open Positions</h2>
            <div className="flex flex-col gap-8">
              {positions.map((position) => (
                <div key={position.slug} className="bento-item flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group" style={{ marginBottom: '24px' }}>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                      {position.title}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">{position.department}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <MapPin className="w-4 h-4" />
                      {position.location}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Briefcase className="w-4 h-4" />
                      {position.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section py-20 bg-[var(--bg-secondary)]">
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
          {/* Title in its own centered div */}
          <div style={{ width: '100%', maxWidth: '1024px', textAlign: 'center', marginBottom: '64px' }}>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Benefits & Perks</h2>
          </div>
          
          {/* Cards in separate container */}
          <div style={{ width: '100%', maxWidth: '1024px' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
              {benefits.map((benefit) => (
                <div key={benefit} className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6 text-center">
                  <p className="text-sm text-[var(--text-secondary)]">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter currentPage="careers" />
    </div>
  );
}
