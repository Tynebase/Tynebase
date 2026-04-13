"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Palette, Upload, Globe, CheckCircle, AlertCircle, Copy, ExternalLink, Loader2, X } from 'lucide-react';
import { FeatureGate } from '@/components/ui/UpgradePrompt';
import { useTenant } from '@/contexts/TenantContext';
import { updateTenant, uploadTenantLogo } from '@/lib/api/settings';

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
  const { tenant, refreshTenant } = useTenant() as any;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant?.settings?.branding?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoSaved, setLogoSaved] = useState(false);

  // Color state — synced from tenant context once it loads
  const [primaryColor, setPrimaryColor] = useState(
    tenant?.settings?.branding?.primary_color ?? '#E85002'
  );
  const [secondaryColor, setSecondaryColor] = useState(
    tenant?.settings?.branding?.secondary_color ?? '#6B7280'
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [colorError, setColorError] = useState('');

  // Sync color & logo state when tenant context finishes loading
  useEffect(() => {
    if (!tenant) return;
    setPrimaryColor(tenant.settings?.branding?.primary_color ?? '#E85002');
    setSecondaryColor(tenant.settings?.branding?.secondary_color ?? '#6B7280');
    setLogoUrl(tenant.settings?.branding?.logo_url ?? null);
  }, [tenant?.id]);

  // ---------- Logo upload ----------
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;

    setLogoError('');
    setUploading(true);
    setLogoSaved(false);

    try {
      const result = await uploadTenantLogo(tenant.id, file);
      setLogoUrl(result.logo_url);
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 3000);
      // Refresh tenant context so the new logo propagates everywhere
      if (typeof refreshTenant === 'function') refreshTenant();
    } catch (e: any) {
      setLogoError(e?.message ?? 'Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!tenant?.id) return;
    try {
      await updateTenant(tenant.id, {
        settings: { branding: { logo_url: undefined } },
      } as any);
      setLogoUrl(null);
      if (typeof refreshTenant === 'function') refreshTenant();
    } catch (e: any) {
      setLogoError(e?.message ?? 'Failed to remove logo.');
    }
  };

  // ---------- Color save ----------
  const handleSaveColors = async () => {
    if (!tenant?.id) {
      setColorError('Tenant not loaded yet. Please wait and try again.');
      return;
    }
    setColorError('');
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
      setColorError(e?.message ?? 'Failed to save. Please try again.');
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
            {/* Preview box */}
            <div className="w-20 h-20 bg-[var(--surface-ground)] rounded-xl flex items-center justify-center border border-dashed border-[var(--dash-border-subtle)] overflow-hidden flex-shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Upload className="h-7 w-7 text-[var(--dash-text-muted)]" />
              )}
            </div>

            <div className="space-y-2 min-w-0">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                className="hidden"
                onChange={handleLogoFileChange}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      Uploading…
                    </>
                  ) : logoUrl ? (
                    'Replace Logo'
                  ) : (
                    'Upload Logo'
                  )}
                </Button>
                {logoUrl && !uploading && (
                  <button
                    onClick={handleRemoveLogo}
                    className="flex items-center gap-1 text-xs text-[var(--dash-text-muted)] hover:text-[var(--status-error)] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--dash-text-muted)]">PNG, JPG, SVG or WebP · Max 2 MB</p>
              {logoError && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--status-error)]">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {logoError}
                </div>
              )}
              {logoSaved && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--status-success)]">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Logo saved.
                </div>
              )}
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
            Set your brand colours — applied to buttons, links and accents throughout your workspace
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

          {colorError && (
            <div className="flex items-center gap-2 text-sm text-[var(--status-error)]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {colorError}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-[var(--status-success)]">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Brand colours saved.
            </div>
          )}

          {/* Live preview */}
          <div className="space-y-2">
            <p className="text-xs text-[var(--dash-text-muted)] font-medium uppercase tracking-wide">Live preview</p>
            <div className="flex items-center gap-4 p-4 bg-[var(--surface-ground)] rounded-xl border border-[var(--dash-border-subtle)]">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg shadow-sm transition-colors"
                  style={{ backgroundColor: primaryColor }}
                  title="Primary colour"
                />
                <div
                  className="w-8 h-8 rounded-lg shadow-sm transition-colors"
                  style={{ backgroundColor: secondaryColor }}
                  title="Secondary colour"
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="px-4 py-1.5 rounded-lg text-white text-sm font-medium transition-colors"
                  style={{ backgroundColor: primaryColor }}
                  tabIndex={-1}
                >
                  Primary button
                </button>
                <button
                  className="px-4 py-1.5 rounded-lg text-white text-sm font-medium transition-colors"
                  style={{ backgroundColor: secondaryColor }}
                  tabIndex={-1}
                >
                  Secondary
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveColors} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save colours'}
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
