"use client";

import Link from "next/link";
import Image from "next/image";

interface SiteNavbarProps {
  currentPage?: 'home' | 'docs' | 'public-documents' | 'help' | 'other';
}

export function SiteNavbar({ currentPage = 'home' }: SiteNavbarProps) {
  // Determine if we should use anchor links or page links
  const featuresLink = currentPage === 'home' ? '#features' : '/#features';
  const pricingLink = currentPage === 'home' ? '#pricing' : '/#pricing';

  return (
    <header className="site-header" style={{ padding: '0 16px', paddingLeft: '32px', paddingRight: '32px' }}>
      <div className="site-header-inner">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
          <span className="nav-logo-glow">
            <Image 
              src="/logo.png" 
              alt="TyneBase" 
              width={35} 
              height={35} 
              className="logo-image"
              style={{ 
                minWidth: '36px', 
                maxWidth: '36px', 
                height: 'auto',
                display: 'block'
              }} 
            />
          </span>
          <span className="shine-text" style={{ fontSize: '24px', fontWeight: 700 }}>
            TyneBase
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-1">
          <a href={featuresLink} className="btn btn-ghost">Features</a>
          <a href={pricingLink} className="btn btn-ghost">Pricing</a>
          <Link href="/help" className={`btn btn-ghost ${currentPage === 'help' ? 'text-[var(--brand)]' : ''}`}>Documentation</Link>
        </nav>

        <div className="flex items-center gap-3 pr-6">
          <Link href="/login" className="btn btn-ghost">Log in</Link>
          <Link href="/signup" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
