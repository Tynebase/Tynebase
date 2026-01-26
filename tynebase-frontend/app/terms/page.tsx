"use client";

import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function TermsPage() {
  return (
    <div className="min-h-screen relative">
      <div className="hero-gradient" />

      <SiteNavbar currentPage="other" />

      <section className="section pt-[180px] pb-[60px]">
        <div className="container text-center">
          <p className="text-sm font-semibold text-[var(--brand)] uppercase tracking-wider mb-4">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-[-0.02em] mb-4">
            Terms of <span className="text-gradient">Service</span>
          </h1>
          <p className="text-[var(--text-muted)]">Last updated: January 12, 2026</p>
        </div>
      </section>

      <section className="section py-12">
        <div className="container">
          <div className="max-w-3xl mx-auto space-y-8 text-[var(--text-secondary)]">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">1. Acceptance of Terms</h2>
              <p className="leading-relaxed">By accessing or using TyneBase, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">2. Description of Service</h2>
              <p className="leading-relaxed">TyneBase provides a knowledge management platform that enables organizations to create, organise, and share documentation. Our services include document editing, AI-assisted content generation, team collaboration, and white-label branding capabilities.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">3. User Accounts</h2>
              <p className="leading-relaxed">You must create an account to use TyneBase. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">4. Acceptable Use</h2>
              <p className="leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the service for any unlawful purpose</li>
                <li>Upload malicious code or content</li>
                <li>Attempt to gain unauthorized access</li>
                <li>Interfere with the service's operation</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">5. Intellectual Property</h2>
              <p className="leading-relaxed">You retain ownership of content you create. By using TyneBase, you grant us a license to host, store, and display your content as necessary to provide the service.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">6. Payment Terms</h2>
              <p className="leading-relaxed">Paid subscriptions are billed in advance. Refunds are available within 14 days of initial purchase. Prices may change with 30 days notice.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">7. Termination</h2>
              <p className="leading-relaxed">We may terminate or suspend your account for violations of these terms. You may cancel your subscription at any time through your account settings.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">8. Contact</h2>
              <p className="leading-relaxed">For questions about these Terms, contact us at legal@tynebase.com.</p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter currentPage="terms" />
    </div>
  );
}
