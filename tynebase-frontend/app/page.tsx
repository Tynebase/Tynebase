"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { BookOpen, Sparkles, Users, Palette, Check, ArrowRight, Zap, Shield, Globe, FileCheck, FolderSync, Bot, UserCog, Search, FileText, MessagesSquare, Lock, BarChart3, Database, Key, UserCheck, ShieldCheck, Clock, Headphones, ShieldAlert, Settings, FileCheck2 } from "lucide-react";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CookieConsent } from "@/components/ui/CookieConsent";

const enterpriseFeatures = [
  { category: 'security', title: 'SSO Integration', description: 'Enable secure, seamless access with single sign-on (SSO) through providers like Okta, Google Workspace and Azure AD.', icon: Key },
  { category: 'security', title: 'Advanced Provisioning', description: 'Automate user lifecycle management with SCIM provisioning for faster, safer onboarding and offboarding.', icon: UserCheck },
  { category: 'security', title: 'Granular Permissions', description: 'Control access at every level with flexible, detailed permissions for teams and projects.', icon: Lock },
  { category: 'compliance', title: 'SOC 2 Type II Compliance', description: 'Meet rigorous security standards with SOC II Type II certification, ensuring enterprise-grade data protection.', icon: Shield },
  { category: 'compliance', title: 'HIPAA Compliance', description: 'Execute a Business Associate Agreement (BAA) to ensure HIPAA-compliant infrastructure with encryption and access controls.', icon: ShieldCheck },
  { category: 'compliance', title: 'GDPR Compliance', description: 'Operate confidently across regions with GDPR-compliant practices that safeguard data privacy.', icon: Globe },
  { category: 'customization', title: 'Personalised Onboarding', description: 'Kickstart adoption with onboarding tailored to your workflows, guided by our customer success team.', icon: Headphones },
  { category: 'customization', title: 'Reader-Only Roles', description: 'Share knowledge broadly while maintaining control by assigning read-only access to specific users.', icon: Users },
  { category: 'customization', title: 'SLA Guarantee', description: 'Count on guaranteed uptime and response times with a service-level agreement built for enterprise reliability.', icon: Clock },
  { category: 'customization', title: 'Dedicated Support', description: "Access priority, hands-on support from specialists who understand your team's needs.", icon: Headphones },
  { category: 'control', title: 'Analytics Dashboard', description: 'Measure adoption and engagement with usage insights to keep your documentation effective.', icon: BarChart3 },
  { category: 'control', title: 'Automated Backups', description: 'Protect your knowledge base with automated backups and fast recovery when needed.', icon: Database },
  { category: 'control', title: 'Audit Logs', description: 'Maintain accountability with complete visibility into who accessed and modified content.', icon: FileText },
];

// Category icon mapping
const categoryIcons = {
  security: Shield,
  customization: Settings,
  compliance: ShieldCheck,
  control: BarChart3,
};

const knowledgeFeatures = [
  {
    id: 'verification',
    title: 'Document verification with automated reminders',
    description: 'Keep your knowledge base accurate with scheduled review cycles and expiry alerts.',
    image: '/images/feature-verification.png'
  },
  {
    id: 'bulk-ops',
    title: 'Bulk operations for knowledge management',
    description: 'Move, archive or update multiple documents at once with powerful batch actions.',
    image: '/images/feature-bulk.png'
  },
  {
    id: 'ai-quality',
    title: 'AI-suggested actions to maintain quality',
    description: 'Get intelligent recommendations to improve outdated or incomplete documentation.',
    image: '/images/feature-ai-quality.png'
  },
  {
    id: 'ownership',
    title: 'Ownership transfer when team members leave',
    description: 'Seamlessly reassign document ownership to maintain accountability.',
    image: '/images/feature-ownership.png'
  }
];

const teamCategories = [
  { id: 'engineering', name: 'Engineering', active: true },
  { id: 'hr', name: 'HR', active: false },
  { id: 'operations', name: 'Operations', active: false },
  { id: 'sales', name: 'Sales', active: false },
  { id: 'support', name: 'Support', active: false },
];

const templates = {
  engineering: [
    { title: 'API Documentation', description: 'Document your REST or GraphQL APIs' },
    { title: 'Architecture Decision Records', description: 'Track technical decisions' },
    { title: 'Runbook Template', description: 'Incident response procedures' },
    { title: 'Onboarding Guide', description: 'New developer setup' },
  ],
  hr: [
    { title: 'Employee Handbook', description: 'Company policies and procedures' },
    { title: 'Benefits Guide', description: 'Compensation and perks' },
    { title: 'Performance Review', description: 'Evaluation templates' },
    { title: 'Hiring Process', description: 'Recruitment workflows' },
  ],
  operations: [
    { title: 'Process Documentation', description: 'Standard operating procedures' },
    { title: 'Vendor Management', description: 'Supplier information' },
    { title: 'Compliance Checklist', description: 'Regulatory requirements' },
    { title: 'Incident Report', description: 'Issue tracking template' },
  ],
  sales: [
    { title: 'Sales Playbook', description: 'Winning strategies' },
    { title: 'Competitor Analysis', description: 'Market intelligence' },
    { title: 'Proposal Template', description: 'Client presentations' },
    { title: 'CRM Guide', description: 'Tool documentation' },
  ],
  support: [
    { title: 'FAQ Template', description: 'Common questions answered' },
    { title: 'Troubleshooting Guide', description: 'Issue resolution steps' },
    { title: 'Escalation Procedures', description: 'When and how to escalate' },
    { title: 'Customer Communication', description: 'Response templates' },
  ],
};

export default function Home() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeTeam, setActiveTeam] = useState('engineering');
  const [isPaused, setIsPaused] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % knowledgeFeatures.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    // Check theme on mount and when it changes
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme !== 'light');
    };

    checkTheme();

    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  const getBorderColor = () => isDarkMode ? '#ffffff' : '#000000';

  return (
    <div className="min-h-screen relative">
      {/* Animated gradient background */}
      <div className="hero-gradient" />

      {/* Header */}
      <SiteNavbar currentPage="home" />

      {/* Hero Section */}
      <section className="section pt-[180px] pb-[100px]">
        <div className="container text-center">
          {/* Announcement badge */}
          <div className="animate-in animate-delay-1" style={{ marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', padding: '12px 24px', borderRadius: '9999px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <Image
                src="/find_tyne_logo.webp"
                alt="Find"
                width={72}
                height={72}
                style={{ width: '42px', height: '42px' }}
              />
              <span style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>Bridging the gap between what you know and what you can find</span>
            </div>
          </div>

          {/* Main headline */}
          <h1 style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '48px', padding: '16px 0' }} className="animate-in animate-delay-2">
            Build a knowledge base
            <br />
            <span className="text-gradient text-glow">that actually scales</span>
          </h1>

          {/* Subheadline */}
          <div style={{ textAlign: 'center', marginBottom: '48px', padding: '24px 0' }} className="animate-in animate-delay-3">
            <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', textAlign: 'left' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)', marginTop: '8px', flexShrink: 0 }}></span>
                <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  We believe knowledge isn't a static archive - it is a semantic conversation. Utilise AI to your company's advantage. Not only to create content, but to find, organise and maintain it.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', textAlign: 'left' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)', marginTop: '8px', flexShrink: 0 }}></span>
                <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Deploy a white-label platform that transforms your team's raw data into refined, accessible knowledge, effortlessly branded as your own.
                </p>
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '64px' }} className="animate-in animate-delay-4">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Start for free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Hero Image Placeholder with Animated Border */}
        <div className="container">
          <div className="relative max-w-[1200px] mx-auto animate-in animate-delay-5">
            {/* Animated gradient border container */}
            <div className="hero-image-container">
              <div className="hero-image-border" />
              <div className="hero-image-placeholder">
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--accent-pink)] flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-lg text-[var(--text-muted)]">Platform Preview Coming Soon</p>
                  <p className="text-sm text-[var(--text-tertiary)]">Experience the future of knowledge management</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Bento Grid */}
      <section id="features" className="section" style={{ paddingTop: '128px', paddingBottom: '128px' }}>
        <div className="container">
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: '96px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
              <Image
                src="/features_logo2.webp"
                alt="Features"
                width={107}
                height={107}
                style={{ width: '107px', height: '107px' }}
              />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>Features</p>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '32px' }}>
              Everything you need to <span className="text-gradient">manage your knowledge</span>
            </h2>
            <div style={{ maxWidth: '800px', margin: '0 auto 64px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', textAlign: 'left' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)', marginTop: '10px', flexShrink: 0 }}></span>
                <p style={{ fontSize: '20px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  A complete platform for documentation, community and team knowledge management.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', textAlign: 'left' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)', marginTop: '10px', flexShrink: 0 }}></span>
                <p style={{ fontSize: '20px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Create, organise and keep your information up to date with powerful AI assistance, real-time collaboration and enterprise-grade security.
                </p>
              </div>
            </div>
          </div>

          {/* Bento grid */}
          <div className="bento-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '24px' }}>
            {/* Feature 1 - Large */}
            <div className="bento-item lg:col-span-2 lg:row-span-2" style={{ padding: '32px' }}>
              <div className="feature-icon feature-icon-brand" style={{ marginBottom: '20px', color: '#ff4d00', background: 'linear-gradient(135deg, rgba(255, 77, 0, 0.2) 0%, rgba(255, 77, 0, 0.05) 100%)' }}>
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Rich Documentation Editor
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', lineHeight: 1.6 }}>
                Create beautiful, structured documentation with our powerful block-based editor.
                Organise content with nested pages, real-time collaboration, version control and instant search across all your knowledge.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px', display: 'block', marginBottom: '4px' }}>Team Workspace</span>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Updated 2 hours ago</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '9999px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 500 }}>Active</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--brand)' }}>📄</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Getting Started Guide</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📋</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Product Roadmap</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🎯</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Team Processes</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white', fontWeight: 500 }}>JD</div>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand), var(--brand-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white', fontWeight: 500, marginLeft: '-4px' }}>SK</div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>+8 team members</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 - AI Assistant */}
            <div className="bento-item">
              <div className="w-12 h-12 mb-5">
                <Image
                  src="/ai_logo_tynebase.webp"
                  alt="AI Assistant"
                  width={60}
                  height={60}
                  style={{ padding: '2px' }}
                  className="w-12 h-12 object-contain"
                />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
                <br />
                AI-Powered Assistant
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Generate documentation from prompts, videos and screenshots. Ask questions and get instant answers from your knowledge base. EU-compliant AI with advanced RAG retrieval, keeping your data secure.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bento-item">
              <div className="feature-icon feature-icon-brand" style={{ color: '#ff4d00', background: 'linear-gradient(135deg, rgba(255, 77, 0, 0.2) 0%, rgba(255, 77, 0, 0.05) 100%)' }}>
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Real-Time Collaboration
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Work together seamlessly with live editing, comments, mentions and notifications. See who is viewing and editing in real-time with presence indicators.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bento-item">
              <div className="feature-icon feature-icon-brand" style={{ color: '#ff4d00', background: 'linear-gradient(135deg, rgba(255, 77, 0, 0.2) 0%, rgba(255, 77, 0, 0.05) 100%)' }}>
                <Palette className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Multi-Tenant & White-Label
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Complete customisation for each workspace. Custom domains, branded colours, logos and subdomain routing – perfect for agencies and SaaS platforms.
              </p>
              <div className="mt-4 flex justify-center">
                <Image
                  src="/multi_tenant_logo.png"
                  alt="Multi-Tenant Architecture"
                  width={120}
                  height={120}
                  className="object-contain"
                />
              </div>
            </div>

            {/* Feature 5 - Speed & Security */}
            <div className="bento-item lg:col-span-2 relative" style={{ padding: '32px' }}>
              <div className="sm:hidden block mb-4">
                <div className="feature-icon feature-icon-brand" style={{ color: '#ff4d00', background: 'linear-gradient(135deg, rgba(255, 77, 0, 0.2) 0%, rgba(255, 77, 0, 0.05) 100%)' }}>
                  <Shield className="w-6 h-6" />
                </div>
              </div>
              <div><br />
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
                  Enterprise-Grade Performance & Security
                </h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-lg leading-relaxed mb-8">
                  Lightning-fast performance with sub-100ms response times on a global edge network. Enterprise-ready with SOC2 compliance, GDPR adherence, role-based access control and audit logs.
                </p>

                {/* Features with icon on the right */}
                <div
                  className="grid items-end gap-8"
                  style={{ gridTemplateColumns: 'auto 1fr' }}
                >
                  <div className="space-y-4"><br />
                    {[
                      { icon: Zap, label: 'Edge Network', value: '200+ locations' },
                      { icon: Shield, label: 'Security', value: 'SOC2 & GDPR' },
                      { icon: Globe, label: 'Uptime', value: '99.99% SLA' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 text-[var(--brand)]" />
                        <div>
                          <p className="text-xs text-[var(--text-muted)]">{item.label}</p>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Lightning icon - next to features */}
                  <div className="flex items-end justify-start">
                    <Image
                      src="/lighting_logo2.webp"
                      alt="Enterprise Performance"
                      width={80}
                      height={80}
                      className="w-16 h-16 lg:w-[120px] lg:h-[120px] object-contain opacity-80"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge Management Section */}
      <section className="knowledge-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '96px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--brand), var(--accent-pink))', marginBottom: '32px' }}>
              <svg style={{ width: '32px', height: '32px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 16l-3 3m0 0l-3-3m3 3V10" />
              </svg>
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>Knowledge Management</p>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '32px' }}>
              <span className="text-gradient text-glow">TyneBase</span> keeps your knowledge management simple
            </h2>
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '800px', margin: '0 auto 64px auto', textAlign: 'center', lineHeight: 1.6 }}>
              Built-in tools to keep your documentation accurate, organised and up-to-date.
            </p>
          </div>

          <div
            className="feature-showcase"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Feature List - Left Side */}
            <div className="feature-list">
              {knowledgeFeatures.map((feature, index) => (
                <div
                  key={feature.id}
                  className={`feature-item ${activeFeature === index ? 'active' : ''}`}
                  onClick={() => setActiveFeature(index)}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <h4>{feature.title}</h4>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>

            {/* Feature Preview - Right Side */}
            <div className="feature-preview">
              <div className="feature-preview-placeholder">
                <div className="flex flex-col items-center gap-4">
                  {activeFeature === 0 && <FileCheck className="w-16 h-16 text-[var(--brand)] opacity-60" />}
                  {activeFeature === 1 && <FolderSync className="w-16 h-16 text-[var(--brand)] opacity-60" />}
                  {activeFeature === 2 && <Bot className="w-16 h-16 text-[var(--brand)] opacity-60" />}
                  {activeFeature === 3 && <UserCog className="w-16 h-16 text-[var(--brand)] opacity-60" />}
                  <span className="text-sm text-[var(--text-muted)]">Feature preview placeholder</span>
                  <span className="text-xs text-[var(--text-muted)]">{knowledgeFeatures[activeFeature].title}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Docs for Everyone Section */}
      <section className="templates-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '96px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--brand), var(--accent-pink))', marginBottom: '32px' }}>
              <svg style={{ width: '32px', height: '32px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>Templates</p>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '32px' }}>
              Templates that benefit <span className="text-gradient text-glow">every team</span>
            </h2>
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '800px', margin: '0 auto 64px auto', textAlign: 'center', lineHeight: 1.6 }}>
              Get started quickly with templates for your team's frequently used resources
            </p>
          </div>

          <div className="docs-section">
            {/* Team Tabs - Left Side */}
            <div className="team-tabs">
              {teamCategories.map((team) => (
                <button
                  key={team.id}
                  className={`team-tab ${activeTeam === team.id ? 'active' : ''}`}
                  onClick={() => setActiveTeam(team.id)}
                >
                  {team.name}
                </button>
              ))}
              <Link href="/docs" className="team-tab-link">
                Learn more
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Templates Grid - Right Side */}
            <div className="template-grid">
              {templates[activeTeam as keyof typeof templates].map((template) => (
                <div key={template.title} className="template-card">
                  <h4>{template.title}</h4>
                  <p>{template.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Search Section */}
      <section className="ai-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '96px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Image
                src="/ai_logo1.webp"
                alt="AI"
                width={32}
                height={32}
                style={{ width: '43px', height: '43px' }}
              />
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI-Powered Search</p>
            </div>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '32px' }}>
              Ensuring your knowledge is <span className="text-gradient">accessible, searchable and usable</span>
            </h2>
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '800px', margin: '0 auto 64px auto', textAlign: 'center', lineHeight: 1.6 }}>
              Ask transforms scattered knowledge into instant answers, delivering the right information in seconds.
            </p>
          </div>

          <div className="ai-demo-container">
            {/* Glow effect */}
            <div className="absolute -inset-8 bg-gradient-to-r from-[var(--brand)] via-[var(--brand)] to-[var(--brand)] opacity-15 blur-3xl rounded-3xl" />

            <div className="ai-demo-modal relative">
              <div className="ai-demo-header">
                <Image
                  src="/ai_logo1.webp"
                  alt="AI"
                  width={24}
                  height={24}
                  style={{ width: '24px', height: '24px' }}
                />
                <h4>TyneBase AI Assistant</h4>
              </div>

              <div className="ai-demo-body">
                {/* Search Input */}
                <div className="ai-demo-input">
                  <Search className="w-5 h-5 text-[var(--text-muted)]" />
                  <span className="ai-typing-text">How do I set up SSO for my organization?</span>
                  <span className="ai-typing-cursor" />
                </div>

                {/* AI Response */}
                <div className="ai-demo-response">
                  {/* Sources */}
                  <div className="ai-demo-sources">
                    <div className="ai-source-tag">
                      <span className="dot" />
                      <FileText className="w-3.5 h-3.5" />
                      SSO Configuration Guide
                    </div>
                    <div className="ai-source-tag">
                      <span className="dot" />
                      <FileText className="w-3.5 h-3.5" />
                      Admin Settings Docs
                    </div>
                    <div className="ai-source-tag">
                      <span className="dot" />
                      <MessagesSquare className="w-3.5 h-3.5" />
                      IT Team Discussion
                    </div>
                  </div>

                  {/* Answer */}
                  <div className="ai-demo-answer">
                    <p>
                      To set up <strong>Single Sign-On (SSO)</strong> for your organization:
                    </p>
                    <ol className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                      <li>1. Navigate to <strong>Settings → Security → SSO Configuration</strong></li>
                      <li>2. Select your identity provider (Okta, Azure AD or Google Workspace)</li>
                      <li>3. Enter your <strong>Entity ID</strong> and <strong>SSO URL</strong> from your IdP</li>
                      <li>4. Upload your SAML certificate and save changes</li>
                    </ol>
                    <p className="mt-4 text-xs text-[var(--text-muted)]">
                      Sources: SSO Configuration Guide, Admin Settings Documentation
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="enterprise-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '96px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>Enterprise</p>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '32px' }}>
              We scale with your <span className="text-gradient">ambitions</span>
            </h2>
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '800px', margin: '0 auto 64px auto', textAlign: 'center', lineHeight: 1.6 }}>
              Enterprise-grade security, control and flexibility enabling scaled knowledge-sharing with confidence.
            </p>
          </div>

          <div className="enterprise-grid">
            {enterpriseFeatures.map((feature, index) => {
              const CategoryIcon = categoryIcons[feature.category as keyof typeof categoryIcons];
              return (
                <div key={index} className="enterprise-card">
                  <div className="flex items-start gap-3 mb-4 sm:items-center" style={{ alignItems: 'flex-start' }}>
                    <div className="feature-icon feature-icon-brand flex-shrink-0" style={{ color: '#ff4d00', background: 'linear-gradient(135deg, rgba(255, 77, 0, 0.2) 0%, rgba(255, 77, 0, 0.05) 100%)', width: '36px', height: '36px', flexShrink: 0, marginTop: '-4px' }}>
                      <CategoryIcon className="w-4 h-4" />
                    </div>
                    <h4 style={{ flex: 1, wordWrap: 'break-word', overflowWrap: 'break-word', marginTop: '4px' }}>{feature.title}</h4>
                  </div>
                  <p>{feature.description}</p>
                </div>
              );
            })}
          </div>

          <div className="h-4" />
          <div className="text-center mt-16">
            <Link href="/contact" className="btn btn-primary btn-lg">
              Contact Sales
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="section py-32">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--brand), var(--accent-pink))', marginBottom: '32px' }}>
              <Image
                src="/pound_logo.png"
                alt="pound"
                width={42}
                height={42}
                style={{ width: '42px', height: '42px' }}
              />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>Pricing</p>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '24px' }}>
              Start free and scale as you grow
            </h2>
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 40px auto', textAlign: 'center', lineHeight: 1.6 }}>
              No hidden fees. No credit card required.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-4 bg-[var(--bg-secondary)] rounded-full border border-[var(--border-subtle)]"
              style={{ padding: '0.5rem' }} >
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`rounded-full text-sm font-medium transition-all ${billingPeriod === 'monthly'
                  ? 'bg-[var(--brand)] text-white glow-shadow-brand'
                  : 'px-5 py-2.5 text- hover:text-'
                  }`}
                // Use inline style when selected to force padding
                style={billingPeriod === 'monthly' ? { padding: '0.75rem 2rem' } : {}}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`rounded-full text-sm font-medium transition-all flex items-center gap-2 ${billingPeriod === 'yearly'
                  ? 'bg-[var(--brand)] text-white glow-shadow-brand'
                  : 'px-5 py-2.5 text- hover:text-'
                  }`}
                // Use inline style when selected to force padding
                style={billingPeriod === 'yearly' ? { padding: '0.75rem 2rem' } : {}}
              >
                Yearly
                <span style={{ padding: '2px 6px' }} className={`text-xs rounded-full ${billingPeriod === 'yearly'
                  ? 'bg-white/20 text-black'
                  : 'bg-[var(--brand)]/20 text-[var(--brand)]'
                  }`}>Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto items-stretch">
            {/* Free */}
            <div className="pricing-card-black-border" style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', padding: '32px', display: 'flex', flexDirection: 'column', transition: 'all var(--duration-normal) var(--ease-out)', border: `1px solid ${getBorderColor()}` }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Free</h3>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-[var(--text-primary)]">£0</span>
                  <span style={{ color: 'var(--text-primary)' }}>/month</span>
                </div>
              </div>
              <div className="flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <ul className="space-y-3">
                    {['1 solo account', '100 documents max', '10 AI queries per month', 'Basic search', 'Community support'].map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <Check className="w-4 h-4 text-[var(--brand)] flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginTop: '28px' }}>
                  <Link href="/signup" className="btn btn-secondary w-full" style={{ padding: '16px 32px', fontSize: '15px' }}>
                    Start for Free
                  </Link>
                </div>
              </div>
            </div>

            {/* Base - Highlighted */}
            <div className="pricing-card pricing-card-featured relative overflow-visible">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="badge badge-brand">Popular</span>
              </div>
              <div style={{ marginBottom: '16px', paddingTop: '8px' }}>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Base</h3>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-[var(--text-primary)]">
                    £{billingPeriod === 'monthly' ? '29' : '23'}
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>/month</span>
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">Billed annually (£276/year)</p>
                  )}
                </div>
              </div>
              <div className="flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <ul className="space-y-3">
                    {['Up to 5 users', 'Unlimited documents', '1GB Storage limit', '100 AI queries per month', 'Full AI capabilities', 'Version control'].map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <Check className="w-4 h-4 text-[var(--brand)] flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginTop: '28px' }}>
                  <Link href="/signup" className="btn btn-primary w-full" style={{ padding: '16px 32px', fontSize: '15px' }}>
                    Get started
                  </Link>
                </div>
              </div>
            </div>

            {/* Pro */}
            <div className="pricing-card-black-border" style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', padding: '32px', display: 'flex', flexDirection: 'column', transition: 'all var(--duration-normal) var(--ease-out)', border: `1px solid ${getBorderColor()}` }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Pro</h3>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-[var(--text-primary)]">
                    £{billingPeriod === 'monthly' ? '99' : '79'}
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>/month</span>
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">Billed annually (£948/year)</p>
                  )}
                </div>
              </div>
              <div className="flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <ul className="space-y-3">
                    {['Up to 10 users', 'Unlimited documents', '10GB Storage limit', '500 AI queries per month', 'White-label branding', 'Advanced analytics', 'Custom domain', 'Priority support', 'Audit logs'].map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        <Check className="w-4 h-4 text-[var(--brand)] flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginTop: '28px' }}>
                  <Link href="/signup" className="btn btn-secondary w-full" style={{ padding: '16px 32px', fontSize: '15px' }}>
                    Get started
                  </Link>
                </div>
              </div>
            </div>

            {/* Enterprise - Custom styled */}
            <div className="pricing-card-enterprise" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="pricing-card-enterprise-inner" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Section 1: Title */}
                <div style={{ marginBottom: '16px' }}>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Enterprise</h3>
                </div>

                {/* Section 2: Price and description */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <span className="text-4xl font-bold text-[var(--text-primary)]">Custom</span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">Tailored for your organization</p>
                </div>

                {/* Section 3: Features */}
                <div style={{ marginBottom: '24px' }}>
                  <ul className="space-y-3">
                    {['All Pro features', 'Unlimited Users', 'Unlimited Documents', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'On-premise option', 'Rollover credits'].map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <Check className="w-4 h-4 text-[var(--brand)] flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Section 4: Button */}
                <div style={{ marginTop: '28px' }}>
                  <Link href="/contact" className="btn btn-primary w-full" style={{ padding: '16px 32px', fontSize: '15px' }}>
                    Contact sales
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Query Top-ups Section */}
          <div className="mt-20 max-w-4xl mx-auto p-8 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] relative overflow-hidden group hover:border-[var(--brand)] transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand)] opacity-5 blur-3xl -mr-16 -mt-16 group-hover:opacity-10 transition-opacity" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2 flex items-center justify-center md:justify-start gap-2">
                  <Sparkles className="w-5 h-5 text-[var(--brand)]" />
                  Need more queries?
                </h3>
                <p className="text-[var(--text-secondary)]">
                  Purchase query top-ups anytime. Never run out of AI power for your team.
                  <span className="block mt-1 text-xs text-[var(--text-muted)]">Available for all paid plans. Expires at month end.</span>
                </p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">£9.99</p>
                    <p className="text-xs text-[var(--text-muted)]">100 Queries</p>
                  </div>
                  <div className="w-px h-8 bg-[var(--border-subtle)]" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">£39.99</p>
                    <p className="text-xs text-[var(--text-muted)]">500 Queries</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Document Editor Section */}
      <section className="editor-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '96px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--brand), var(--accent-pink))', marginBottom: '32px' }}>
              <svg style={{ width: '32px', height: '32px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '32px' }}>Document Editor</p>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '32px' }}>
              The editor that <span className="text-gradient text-glow">supports you</span>
            </h2>
            <p style={{ fontSize: '20px', color: 'var(--text-secondary)', maxWidth: '800px', margin: '0 auto 64px auto', textAlign: 'center', lineHeight: 1.6 }}>
              A smooth writing experience. Fast, flexible and packed with features that makes documentation a joy, not a chore.
            </p>
          </div>

          <div className="editor-showcase">
            {/* Features List - Left Side */}
            <div className="editor-features">
              <div className="editor-feature-group">
                <h4 className="editor-feature-title">Just the right formatting</h4>
                <div className="editor-feature-grid">
                  {['Headings', 'Bold', 'Italic', 'Underline', 'Strikethrough', 'Link', 'Bullet List', 'Numbered List', 'Checklist', 'Tables', 'Quote', 'Code Block', 'Inline Code', 'Highlight', 'Divider'].map((item) => (
                    <span key={item} className="editor-feature-tag">{item}</span>
                  ))}
                </div>
              </div>

              <div className="editor-feature-group">
                <h4 className="editor-feature-title">Beyond words</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Use images, videos, embeds and hundreds of integrations to get ideas across clearly.</p>
                <div className="editor-feature-grid">
                  {['Images', 'Video', 'Gallery', 'Attachments', 'Embeds', 'Diagrams', 'Math Equations', 'Callouts'].map((item) => (
                    <span key={item} className="editor-feature-tag">{item}</span>
                  ))}
                </div>
              </div>

              <div className="editor-feature-group">
                <h4 className="editor-feature-title">Built for teams</h4>
                <div style={{ margin: '0', padding: '0' }}>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', margin: '0 0 16px 0', padding: '0' }}>
                    <Users className="w-5 h-5 text-[var(--brand)] flex-shrink-0" style={{ marginTop: '0' }} />
                    <div style={{ marginTop: '0', marginBottom: '0' }}>
                      <strong style={{ display: 'block', marginBottom: '2px', color: '#ffffff' }}>Real-time collaboration</strong>
                      <p style={{ margin: '0', lineHeight: '1.4' }}>Write together with your team and see changes instantly</p>
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', margin: '0 0 16px 0', padding: '0' }}>
                    <FileText className="w-5 h-5 text-[var(--brand)] flex-shrink-0" style={{ marginTop: '0' }} />
                    <div style={{ marginTop: '0', marginBottom: '0' }}>
                      <strong style={{ display: 'block', marginBottom: '2px', color: '#ffffff' }}>Markdown support</strong>
                      <p style={{ margin: '0', lineHeight: '1.4' }}>Type in Markdown and export to .md anytime</p>
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', margin: '0 0 16px 0', padding: '0' }}>
                    <Zap className="w-5 h-5 text-[var(--brand)] flex-shrink-0" style={{ marginTop: '0' }} />
                    <div style={{ marginTop: '0', marginBottom: '0' }}>
                      <strong style={{ display: 'block', marginBottom: '2px', color: '#ffffff' }}>Keyboard shortcuts</strong>
                      <p style={{ margin: '0', lineHeight: '1.4' }}>Power-user combos for everything</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', margin: '0', padding: '0' }}>
                    <Clock className="w-5 h-5 text-[var(--brand)] flex-shrink-0" style={{ marginTop: '0' }} />
                    <div style={{ marginTop: '0', marginBottom: '0' }}>
                      <strong style={{ display: 'block', marginBottom: '2px', color: '#ffffff' }}>Version history</strong>
                      <p style={{ margin: '0', lineHeight: '1.4' }}>Travel back in time and restore any version</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Editor Preview - Right Side */}
            <div className="editor-preview">
              <div className="editor-preview-window">
                {/* Editor toolbar */}
                <div className="editor-toolbar">
                  <div className="editor-toolbar-group">
                    <button className="editor-toolbar-btn active">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                    </button>
                    <button className="editor-toolbar-btn">
                      <strong className="text-xs">B</strong>
                    </button>
                    <button className="editor-toolbar-btn">
                      <em className="text-xs">I</em>
                    </button>
                    <button className="editor-toolbar-btn">
                      <span className="text-xs underline">U</span>
                    </button>
                  </div>
                  <div className="editor-toolbar-divider" />
                  <div className="editor-toolbar-group">
                    <button className="editor-toolbar-btn">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    </button>
                    <button className="editor-toolbar-btn">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </button>
                    <button className="editor-toolbar-btn">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </button>
                  </div>
                </div>

                {/* Editor content */}
                <div className="editor-content">
                  <h1 className="editor-h1">Getting started with TyneBase</h1>
                  <p className="editor-paragraph">Welcome to your new knowledge base. This guide will help you get up and running in minutes.</p>

                  <h2 className="editor-h2">Quick start</h2>
                  <ul className="editor-list">
                    <li><Check className="w-4 h-4 text-[var(--brand)]" /> Create your first document</li>
                    <li><Check className="w-4 h-4 text-[var(--brand)]" /> Invite team members</li>
                    <li className="opacity-50">Set up your workspace branding</li>
                  </ul>

                  <div className="editor-callout">
                    <Sparkles className="w-5 h-5 text-[var(--brand)]" />
                    <div>
                      <strong>Pro tip:</strong> Use <code>/</code> to access quick commands and insert blocks instantly.
                    </div>
                  </div>

                  <div className="editor-cursor" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-sm">
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '896px' }}>
            {/* Background glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-purple)] to-[var(--accent-pink)] opacity-20 blur-3xl rounded-3xl" />

            <div style={{ position: 'relative', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '64px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ fontSize: 'clamp(1.875rem, 4vw, 2.5rem)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>
                Ready to get started?
              </h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', marginBottom: '40px', lineHeight: 1.6 }}>
                Start using TyneBase today to build and share knowledge.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <Link href="/signup" className="btn btn-primary btn-lg">
                  Start for free
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/contact" className="btn btn-secondary btn-lg">
                  Talk to sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter currentPage="home" />

      <CookieConsent />
    </div>
  );
}
