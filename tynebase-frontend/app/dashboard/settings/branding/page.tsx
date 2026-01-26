"use client";

import { useTenant } from "@/contexts/TenantContext";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { 
  Upload, Palette, Type, Globe, Eye, Check, Crown, Sparkles,
  Monitor, Smartphone, Sun, Moon, RefreshCw, Save, ExternalLink
} from "lucide-react";

// Pricing tiers with features
const tiers = {
  free: { name: "Free", price: 0, whiteLabel: false, customDomain: false },
  base: { name: "Base", price: 29, whiteLabel: false, customDomain: false },
  pro: { name: "Pro", price: 99, whiteLabel: true, customDomain: true },
  enterprise: { name: "Enterprise", price: null, whiteLabel: true, customDomain: true },
};

// Mock current tier - in production this would come from subscription context
const currentTier = "pro"; // Change to "free" or "base" to test tier restrictions

export default function BrandingPage() {
  const { branding, tenant } = useTenant();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  
  const [brandSettings, setBrandSettings] = useState({
    companyName: tenant?.name || "Your Company",
    primaryColor: branding?.primary_color || "#E85002",
    secondaryColor: "#3b82f6",
    accentColor: "#8b5cf6",
    logoLight: null as File | null,
    logoDark: null as File | null,
    favicon: null as File | null,
    customDomain: "",
    customCss: "",
    hideWatermark: true,
    customFonts: false,
    fontHeading: "Helvetica Neue",
    fontBody: "Inter",
  });

  const tierConfig = tiers[currentTier as keyof typeof tiers];
  const canUseWhiteLabel = tierConfig.whiteLabel;
  const canUseCustomDomain = tierConfig.customDomain;

  const handleSave = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    document.documentElement.style.setProperty("--brand", brandSettings.primaryColor);
    addToast({
      type: "success",
      title: "Branding updated",
      description: "Your white-label settings have been saved and applied.",
    });
    setIsLoading(false);
  };

  const handleReset = () => {
    setBrandSettings({
      ...brandSettings,
      primaryColor: "#E85002",
      secondaryColor: "#3b82f6",
      accentColor: "#8b5cf6",
    });
    addToast({
      type: "info",
      title: "Colors reset",
      description: "Brand colors have been reset to defaults.",
    });
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">White-Label Branding</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Customize your workspace appearance and make it your own
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            canUseWhiteLabel 
              ? "bg-[var(--status-success-bg)] text-[var(--status-success)]" 
              : "bg-[var(--surface-ground)] text-[var(--dash-text-muted)]"
          }`}>
            <Crown className="w-4 h-4" />
            {tierConfig.name} Plan
          </span>
        </div>
      </div>

      {/* Tier Upgrade Banner (shown for lower tiers) */}
      {!canUseWhiteLabel && (
        <div className="bg-gradient-to-r from-[var(--brand)] to-[var(--accent-purple)] rounded-xl p-7 sm:p-8 text-white">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Unlock Full White-Label Features</h3>
                <p className="text-white/80 text-sm mt-1">
                  Upgrade to Pro to remove TyneBase branding, add custom domains, and fully customize your workspace.
                </p>
              </div>
            </div>
            <Link 
              href="/pricing"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[var(--brand)] rounded-xl font-semibold hover:bg-white/90 transition-colors"
            >
              Upgrade to Pro
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-10 items-start">
        {/* Settings Column */}
        <div className="min-h-0 space-y-8">
          {/* Company Name */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
            <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)]">
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <Type className="w-5 h-5 text-[var(--brand)]" />
                Company Name
              </h2>
            </div>
            <div className="p-7">
              <input
                type="text"
                value={brandSettings.companyName}
                onChange={(e) => setBrandSettings({ ...brandSettings, companyName: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                placeholder="Your Company Name"
              />
            </div>
          </div>

          {/* Brand Colors */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
            <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)]">
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <Palette className="w-5 h-5 text-[var(--brand)]" />
                Brand Colors
              </h2>
            </div>
            <div className="p-7 space-y-6">
              {[
                { key: "primaryColor", label: "Primary Color", desc: "Main brand color for buttons and accents" },
                { key: "secondaryColor", label: "Secondary Color", desc: "Supporting color for highlights" },
                { key: "accentColor", label: "Accent Color", desc: "Used for special elements" },
              ].map((color) => (
                <div key={color.key}>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    {color.label}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandSettings[color.key as keyof typeof brandSettings] as string}
                      onChange={(e) => setBrandSettings({ ...brandSettings, [color.key]: e.target.value })}
                      className="h-12 w-16 rounded-lg border-2 border-[var(--dash-border-subtle)] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandSettings[color.key as keyof typeof brandSettings] as string}
                      onChange={(e) => setBrandSettings({ ...brandSettings, [color.key]: e.target.value })}
                      className="flex-1 px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--brand)]"
                    />
                  </div>
                  <p className="text-xs text-[var(--dash-text-muted)] mt-1">{color.desc}</p>
                </div>
              ))}
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] hover:text-[var(--brand)] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset to defaults
              </button>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
            <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)]">
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <Upload className="w-5 h-5 text-[var(--brand)]" />
                Logo & Assets
              </h2>
            </div>
            <div className="p-7 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "logoLight", label: "Light Mode Logo", icon: Sun },
                  { key: "logoDark", label: "Dark Mode Logo", icon: Moon },
                ].map((logo) => (
                  <div key={logo.key}>
                    <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2 flex items-center gap-2">
                      <logo.icon className="w-4 h-4" />
                      {logo.label}
                    </label>
                    <div className="border-2 border-dashed border-[var(--dash-border-subtle)] rounded-xl p-6 text-center hover:border-[var(--brand)] transition-colors cursor-pointer group">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--dash-text-muted)] group-hover:text-[var(--brand)]" />
                      <p className="text-xs text-[var(--dash-text-muted)]">
                        PNG, SVG (max 2MB)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Favicon
                </label>
                <div className="border-2 border-dashed border-[var(--dash-border-subtle)] rounded-xl p-6 text-center hover:border-[var(--brand)] transition-colors cursor-pointer group">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--dash-text-muted)] group-hover:text-[var(--brand)]" />
                  <p className="text-xs text-[var(--dash-text-muted)]">
                    ICO or PNG (32x32 or 64x64)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Domain (Pro feature) */}
          <div className={`bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden ${!canUseCustomDomain ? 'opacity-60' : ''}`}>
            <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <Globe className="w-5 h-5 text-[var(--brand)]" />
                Custom Domain
              </h2>
              {!canUseCustomDomain && (
                <span className="text-xs px-2 py-1 bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] rounded-full font-medium">
                  Pro Feature
                </span>
              )}
            </div>
            <div className="p-7">
              <input
                type="text"
                value={brandSettings.customDomain}
                onChange={(e) => setBrandSettings({ ...brandSettings, customDomain: e.target.value })}
                disabled={!canUseCustomDomain}
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] disabled:cursor-not-allowed transition-all"
                placeholder="docs.yourcompany.com"
              />
              <p className="text-xs text-[var(--dash-text-muted)] mt-2">
                Point your CNAME record to app.tynebase.com
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-xl text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] font-medium transition-colors"
            >
              Reset All
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 px-7 py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 text-white rounded-xl font-semibold transition-all hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="min-h-0 space-y-8">
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden sticky top-8 self-start">
            <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <Eye className="w-5 h-5 text-[var(--brand)]" />
                Live Preview
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[var(--surface-ground)] rounded-lg p-1">
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={`p-1.5 rounded-md transition-colors ${previewMode === "desktop" ? "bg-[var(--surface-card)] shadow-sm" : ""}`}
                  >
                    <Monitor className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                  </button>
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={`p-1.5 rounded-md transition-colors ${previewMode === "mobile" ? "bg-[var(--surface-card)] shadow-sm" : ""}`}
                  >
                    <Smartphone className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-7">
              {/* Preview Container */}
              <div className={`mx-auto transition-all ${previewMode === "mobile" ? "max-w-[320px]" : ""}`}>
                {/* Mock App Header */}
                <div className="bg-[var(--surface-ground)] rounded-t-xl p-4 border border-[var(--dash-border-subtle)] border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: brandSettings.primaryColor }}
                      >
                        {brandSettings.companyName.charAt(0)}
                      </div>
                      <span className="font-semibold text-[var(--dash-text-primary)]" style={{ color: brandSettings.primaryColor }}>
                        {brandSettings.companyName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--dash-border-subtle)]" />
                    </div>
                  </div>
                </div>

                {/* Mock Content */}
                <div className="bg-[var(--surface-card)] rounded-b-xl p-4 border border-[var(--dash-border-subtle)] space-y-4">
                  {/* Button Preview */}
                  <div>
                    <p className="text-xs text-[var(--dash-text-muted)] mb-2">Buttons</p>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                        style={{ backgroundColor: brandSettings.primaryColor }}
                      >
                        Primary
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium border-2"
                        style={{ borderColor: brandSettings.primaryColor, color: brandSettings.primaryColor }}
                      >
                        Secondary
                      </button>
                    </div>
                  </div>

                  {/* Link Preview */}
                  <div>
                    <p className="text-xs text-[var(--dash-text-muted)] mb-2">Links & Text</p>
                    <p className="text-sm text-[var(--dash-text-secondary)]">
                      Regular text with a{" "}
                      <span style={{ color: brandSettings.primaryColor }} className="font-medium cursor-pointer hover:underline">
                        branded link
                      </span>{" "}
                      inside.
                    </p>
                  </div>

                  {/* Card Preview */}
                  <div>
                    <p className="text-xs text-[var(--dash-text-muted)] mb-2">Cards & Borders</p>
                    <div 
                      className="p-3 rounded-lg border-l-4"
                      style={{ borderLeftColor: brandSettings.primaryColor, backgroundColor: `${brandSettings.primaryColor}10` }}
                    >
                      <p className="text-sm font-medium text-[var(--dash-text-primary)]">Highlighted Card</p>
                      <p className="text-xs text-[var(--dash-text-tertiary)]">With your brand accent</p>
                    </div>
                  </div>

                  {/* Badge Preview */}
                  <div>
                    <p className="text-xs text-[var(--dash-text-muted)] mb-2">Badges</p>
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: brandSettings.primaryColor }}
                      >
                        Active
                      </span>
                      <span 
                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${brandSettings.secondaryColor}20`, color: brandSettings.secondaryColor }}
                      >
                        Info
                      </span>
                      <span 
                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${brandSettings.accentColor}20`, color: brandSettings.accentColor }}
                      >
                        Special
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watermark Notice */}
              {canUseWhiteLabel && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--status-success)]">
                  <Check className="w-4 h-4" />
                  TyneBase branding will be hidden
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
