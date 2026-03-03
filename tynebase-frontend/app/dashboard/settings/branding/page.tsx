"use client";

import { useTenant } from "@/contexts/TenantContext";
import { useState, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { updateTenant } from "@/lib/api/settings";
import Link from "next/link";
import { TIER_CONFIG, TierType } from "@/types/api";
import { 
  Upload, Palette, Type, Globe, Eye, Check, Crown, Sparkles,
  Monitor, Smartphone, Sun, Moon, RefreshCw, Save, ExternalLink,
  CheckCircle2
} from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export default function BrandingPage() {
  const { branding, tenant, tierConfig, canUseFeature } = useTenant();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  
  const logoLightRef = useRef<HTMLInputElement>(null);
  const logoDarkRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const [brandSettings, setBrandSettings] = useState({
    companyName: tenant?.name || "Your Company",
    primaryColor: branding?.primary_color || "#E85002",
    secondaryColor: "#3b82f6",
    accentColor: "#8b5cf6",
    logoLight: null as File | null,
    logoDark: null as File | null,
    favicon: null as File | null,
    customCss: "",
    hideWatermark: true,
    customFonts: false,
    fontHeading: "Helvetica Neue",
    fontBody: "Inter",
  });
  // Get tier-based feature access from context
  const currentTier = tenant?.tier || 'free';
  const canUseWhiteLabel = canUseFeature('whiteLabel');

  const handleSave = async () => {
    if (!tenant?.id) {
      addToast({
        type: "error",
        title: "Error",
        description: "Tenant information not available",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Build update payload
      const updatePayload: any = {
        name: brandSettings.companyName,
        settings: {
          branding: {
            primary_color: brandSettings.primaryColor,
            secondary_color: brandSettings.secondaryColor,
            company_name: brandSettings.companyName,
          },
        },
      };

      // Call backend API to update tenant settings
      await updateTenant(tenant.id, updatePayload);

      // Apply branding CSS variable
      document.documentElement.style.setProperty("--brand", brandSettings.primaryColor);
      
      addToast({
        type: "success",
        title: "Branding updated",
        description: "Your white-label settings have been saved and applied.",
      });
    } catch (error) {
      console.error("Failed to update branding:", error);
      addToast({
        type: "error",
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to save branding settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const handleResetClick = () => {
    setShowResetConfirmModal(true);
  };

  const handleResetConfirm = () => {
    setBrandSettings({
      ...brandSettings,
      companyName: tenant?.name || "Your Company",
      primaryColor: "#E85002",
      secondaryColor: "#3b82f6",
      accentColor: "#8b5cf6",
    });
    setShowResetConfirmModal(false);
    addToast({
      type: "success",
      title: "Settings reset",
      description: "Brand colours and company name have been reset to defaults.",
    });
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">White-Label Branding</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Customise your workspace appearance and make it your own
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            canUseWhiteLabel 
              ? "bg-[var(--status-success-bg)] text-[var(--status-success)]" 
              : "bg-[var(--surface-ground)] text-[var(--dash-text-muted)]"
          }`}>
            <Crown className="w-4 h-4" />
            {tierConfig?.name || 'Free'} Plan
          </span>
        </div>
      </div>

      {/* Tier Upgrade Banner (shown for lower tiers) */}
      {!canUseWhiteLabel && (
        <div className="bg-gradient-to-r from-[#E85002] to-[#8b5cf6] rounded-xl p-7 sm:p-8 text-white">
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
              href="/dashboard/settings/billing"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#E85002] rounded-xl font-semibold hover:bg-white/90 transition-colors shadow-md"
              style={{ backgroundColor: '#ffffff', color: '#E85002' }}
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
                onClick={handleResetClick}
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
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2 flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    Light Mode Logo
                  </label>
                  <input type="file" ref={logoLightRef} accept=".png,.svg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setBrandSettings({ ...brandSettings, logoLight: f }); }} />
                  <div onClick={() => logoLightRef.current?.click()} className="border-2 border-dashed border-[var(--dash-border-subtle)] rounded-xl p-6 text-center hover:border-[var(--brand)] transition-colors cursor-pointer group">
                    {brandSettings.logoLight ? (
                      <p className="text-sm text-[var(--brand)] font-medium">{brandSettings.logoLight.name}</p>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--dash-text-muted)] group-hover:text-[var(--brand)]" />
                        <p className="text-xs text-[var(--dash-text-muted)]">PNG, SVG (max 2MB)</p>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2 flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    Dark Mode Logo
                  </label>
                  <input type="file" ref={logoDarkRef} accept=".png,.svg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setBrandSettings({ ...brandSettings, logoDark: f }); }} />
                  <div onClick={() => logoDarkRef.current?.click()} className="border-2 border-dashed border-[var(--dash-border-subtle)] rounded-xl p-6 text-center hover:border-[var(--brand)] transition-colors cursor-pointer group">
                    {brandSettings.logoDark ? (
                      <p className="text-sm text-[var(--brand)] font-medium">{brandSettings.logoDark.name}</p>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--dash-text-muted)] group-hover:text-[var(--brand)]" />
                        <p className="text-xs text-[var(--dash-text-muted)]">PNG, SVG (max 2MB)</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Favicon
                </label>
                <input type="file" ref={faviconRef} accept=".ico,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setBrandSettings({ ...brandSettings, favicon: f }); }} />
                <div onClick={() => faviconRef.current?.click()} className="border-2 border-dashed border-[var(--dash-border-subtle)] rounded-xl p-6 text-center hover:border-[var(--brand)] transition-colors cursor-pointer group">
                  {brandSettings.favicon ? (
                    <p className="text-sm text-[var(--brand)] font-medium">{brandSettings.favicon.name}</p>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--dash-text-muted)] group-hover:text-[var(--brand)]" />
                      <p className="text-xs text-[var(--dash-text-muted)]">ICO or PNG (32x32 or 64x64)</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Branded Subdomain (Pro/Enterprise) */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
            <div className="px-7 py-5 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
              <h2 className="font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <Globe className="w-5 h-5 text-[var(--brand)]" />
                Your Branded URL
              </h2>
              <span className="text-xs px-2 py-1 bg-emerald-500/15 text-emerald-400 rounded-full font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            </div>
            <div className="p-7 space-y-4">
              <div className="bg-[var(--surface-ground)] rounded-xl p-4">
                <p className="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Your workspace is live at:</p>
                <a
                  href={`https://${tenant?.subdomain}.tynebase.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[var(--brand)] font-mono text-sm hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  {tenant?.subdomain}.tynebase.com
                </a>
              </div>
              <p className="text-xs text-[var(--dash-text-muted)]">
                All pages at this URL use your brand colours, logo and company name. Share this URL with your team and clients for a fully branded experience.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleResetClick}
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

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirmModal}
        onClose={() => setShowResetConfirmModal(false)}
        title="Reset All Settings?"
        description="This will reset all brand settings to their default values."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--dash-text-secondary)]">
            Are you sure you want to reset your company name and brand colours to the default settings?
          </p>
        </div>
        
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setShowResetConfirmModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleResetConfirm}
            className="bg-[var(--status-error)] hover:bg-[var(--status-error)]/90"
          >
            Reset All
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
