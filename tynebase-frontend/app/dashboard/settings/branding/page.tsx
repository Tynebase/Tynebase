"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Palette, Upload, Globe, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { FeatureGate } from '@/components/ui/UpgradePrompt';
import { useTenant } from '@/contexts/TenantContext';
import { updateTenant } from '@/lib/api/settings';

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--dash-text-primary)]">{children}</label>;
}

// ---------------------------------------------------------------------------
// Custom Domain Section (base+)
// ---------------------------------------------------------------------------
function CustomDomainSection() {
  const { tenant } = useTenant();
  const [domain, setDomain] = useState(tenant?.settings?.custom_domain ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const subdomain = tenant?.subdomain;
  const cname = `${subdomain}.tynebase.com`;

  const handleSave = async () => {
    if (!tenant?.id) return;
    setError('');
    setSaving(true);
    try {
      await updateTenant(tenant.id, {
        settings: { custom_domain: domain.trim() || null },
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-[var(--brand)]" />
          Custom Domain
        </CardTitle>
        <CardDescription>
          Point your own domain to your TyneBase workspace portal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1 – DNS */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--dash-text-primary)]">Step 1 — Add a CNAME record</h3>
          <p className="text-sm text-[var(--dash-text-secondary)]">
            In your DNS provider, create a <code className="px-1.5 py-0.5 bg-[var(--surface-ground)] rounded text-xs font-mono">CNAME</code> record pointing your domain to:
          </p>
          <div className="flex items-center gap-2 p-3 bg-[var(--surface-ground)] rounded-lg font-mono text-sm">
            <span className="flex-1 text-[var(--dash-text-primary)]">{cname}</span>
            <button
              onClick={() => copyToClipboard(cname)}
              className="p-1.5 rounded hover:bg-[var(--surface-hover)] text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)] transition-colors"
              title="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[var(--dash-text-muted)]">
            DNS changes can take up to 48 hours to propagate, though usually much faster.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--dash-border-subtle)]" />

        {/* Step 2 – Enter domain */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--dash-text-primary)]">Step 2 — Enter your domain</h3>
          <div className="flex gap-2">
            <Input
              id="custom-domain"
              placeholder="docs.yourcompany.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-[var(--status-error)]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-[var(--status-success)]">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Domain saved. SSL is provisioned automatically by Vercel.
            </div>
          )}
        </div>

        {/* Current state */}
        {tenant?.settings?.custom_domain && (
          <>
            <div className="h-px bg-[var(--dash-border-subtle)]" />
            <div className="flex items-center justify-between p-3 bg-[var(--surface-ground)] rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--status-success)]" />
                <span className="text-sm font-medium text-[var(--dash-text-primary)]">
                  {tenant.settings.custom_domain}
                </span>
              </div>
              <a
                href={`https://${tenant.settings.custom_domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// White-Label Branding Section (pro+)
// ---------------------------------------------------------------------------
function WhiteLabelBrandingSection() {
  const { tenant } = useTenant();
  const [primaryColor, setPrimaryColor] = useState(
    tenant?.settings?.branding?.primary_color ?? '#E85002'
  );
  const [secondaryColor, setSecondaryColor] = useState(
    tenant?.settings?.branding?.secondary_color ?? '#6B7280'
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!tenant?.id) return;
    setError('');
    setSaving(true);
    try {
      await updateTenant(tenant.id, {
        settings: {
          branding: {
            primary_color: primaryColor,
            secondary_color: secondaryColor,
          },
        },
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-[var(--brand)]" />
            Logo & Identity
          </CardTitle>
          <CardDescription>
            Upload your logo — it will replace TyneBase branding across your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-[var(--surface-ground)] rounded-xl flex items-center justify-center border border-dashed border-[var(--dash-border-subtle)]">
              {tenant?.settings?.branding?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.settings.branding.logo_url}
                  alt="Logo"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <Upload className="h-7 w-7 text-[var(--dash-text-muted)]" />
              )}
            </div>
            <div className="space-y-2">
              <Button variant="outline" size="sm" disabled>
                Upload Logo
              </Button>
              <p className="text-xs text-[var(--dash-text-muted)]">PNG, JPG or SVG · Max 2 MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-[var(--brand)]" />
            Brand Colours
          </CardTitle>
          <CardDescription>
            Set your brand colours - applied to buttons, links and accents throughout your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primary-color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-[var(--dash-border-subtle)] cursor-pointer bg-transparent"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="secondary-color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-[var(--dash-border-subtle)] cursor-pointer bg-transparent"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-[var(--status-error)]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-[var(--status-success)]">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Brand colours saved.
            </div>
          )}

          {/* Live preview swatch */}
          <div className="flex items-center gap-3 p-4 bg-[var(--surface-ground)] rounded-xl border border-[var(--dash-border-subtle)]">
            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: primaryColor }} />
            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: secondaryColor }} />
            <button
              className="ml-auto px-4 py-1.5 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              Preview button
            </button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save colours'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BrandingSettings() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--dash-text-primary)]">Branding & Domain</h1>
        <p className="text-[var(--dash-text-secondary)] mt-1">
          Customise your workspace identity and public portal address
        </p>
      </div>

      {/* Custom Domain — available from Base tier */}
      <FeatureGate feature="customDomain">
        <CustomDomainSection />
      </FeatureGate>

      {/* White-Label Branding — Pro+ only */}
      <FeatureGate feature="whiteLabel">
        <WhiteLabelBrandingSection />
      </FeatureGate>
    </div>
  );
}
