"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Check,
  AlertCircle,
  ExternalLink,
  Copy,
  Trash2,
  Settings,
  Users,
  Lock,
  RefreshCw
} from "lucide-react";

const ssoProviders = [
  {
    id: "saml",
    name: "SAML 2.0",
    description: "Enterprise SSO with SAML protocol",
    status: "configured",
    icon: "🔐",
  },
  {
    id: "oidc",
    name: "OpenID Connect",
    description: "Modern authentication with OIDC",
    status: "not_configured",
    icon: "🔑",
  },
  {
    id: "google",
    name: "Google Workspace",
    description: "Sign in with Google",
    status: "configured",
    icon: "🌐",
  },
  {
    id: "microsoft",
    name: "Microsoft Entra ID",
    description: "Sign in with Microsoft",
    status: "not_configured",
    icon: "🪟",
  },
  {
    id: "okta",
    name: "Okta",
    description: "Enterprise identity management",
    status: "not_configured",
    icon: "🛡️",
  },
];

export default function SSOPage() {
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [configStep, setConfigStep] = useState(1);

  const configuredCount = ssoProviders.filter(p => p.status === "configured").length;

  return (
    <div className="w-full min-h-full flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Single Sign-On (SSO)</h1>
        <p className="text-[var(--text-tertiary)] mt-1">
          Configure enterprise authentication for your workspace
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{configuredCount}</p>
                <p className="text-sm text-[var(--text-tertiary)]">Active Providers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">156</p>
                <p className="text-sm text-[var(--text-tertiary)]">SSO Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">Enforced</p>
                <p className="text-sm text-[var(--text-tertiary)]">SSO Policy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SSO Providers */}
      <Card>
        <CardHeader>
          <CardTitle>Identity Providers</CardTitle>
          <CardDescription>Configure authentication providers for your organization</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--border-subtle)]">
            {ssoProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 hover:bg-[var(--surface-ground)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--surface-ground)] flex items-center justify-center text-2xl">
                    {provider.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--text-primary)]">{provider.name}</p>
                      {provider.status === "configured" && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-tertiary)]">{provider.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {provider.status === "configured" ? (
                    <>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveProvider(provider.id)}
                    >
                      Configure
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SAML Configuration (shown when active) */}
      {activeProvider === "saml" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Configure SAML 2.0</CardTitle>
                <CardDescription>Set up SAML-based single sign-on</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveProvider(null)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Progress Steps */}
            <div className="flex items-center gap-4 mb-8">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${configStep >= step
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-[var(--surface-ground)] text-[var(--text-tertiary)]"
                    }`}>
                    {configStep > step ? <Check className="w-4 h-4" /> : step}
                  </div>
                  <span className={`text-sm ${configStep >= step ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
                    }`}>
                    {step === 1 ? "Service Provider" : step === 2 ? "Identity Provider" : "Test & Enable"}
                  </span>
                  {step < 3 && <div className="w-12 h-px bg-[var(--border-subtle)]" />}
                </div>
              ))}
            </div>

            {configStep === 1 && (
              <div className="space-y-6">
                <div className="bg-[var(--surface-ground)] rounded-xl p-4">
                  <h4 className="font-medium text-[var(--text-primary)] mb-3">Service Provider Details</h4>
                  <p className="text-sm text-[var(--text-tertiary)] mb-4">
                    Add these values to your identity provider configuration
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                        Entity ID (Issuer)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          value="https://tynebase.com/saml/metadata"
                          readOnly
                          className="flex-1 bg-[var(--surface-card)]"
                        />
                        <Button variant="outline" size="sm">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                        ACS URL (Reply URL)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          value="https://tynebase.com/saml/acs"
                          readOnly
                          className="flex-1 bg-[var(--surface-card)]"
                        />
                        <Button variant="outline" size="sm">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                        Metadata URL
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          value="https://tynebase.com/saml/metadata.xml"
                          readOnly
                          className="flex-1 bg-[var(--surface-card)]"
                        />
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="primary" onClick={() => setConfigStep(2)}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {configStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                      Identity Provider Entity ID
                    </label>
                    <Input placeholder="https://idp.example.com/saml/metadata" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                      SSO URL (Login URL)
                    </label>
                    <Input placeholder="https://idp.example.com/saml/sso" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                      X.509 Certificate
                    </label>
                    <textarea
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      rows={4}
                      className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)] font-mono text-sm resize-none"
                    />
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">Certificate Requirements</p>
                      <p className="text-amber-700 mt-1">
                        The certificate must be in PEM format. You can download this from your identity provider.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setConfigStep(1)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setConfigStep(3)}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {configStep === 3 && (
              <div className="space-y-6">
                <div className="bg-[var(--surface-ground)] rounded-xl p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Configuration Complete
                  </h4>
                  <p className="text-sm text-[var(--text-tertiary)] mb-4">
                    Test your SSO configuration before enabling it for all users
                  </p>
                  <Button variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Test SSO Login
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[var(--surface-ground)] rounded-lg">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Enforce SSO</p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        Require all users to authenticate via SSO
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-[var(--border-default)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[var(--surface-ground)] rounded-lg">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Auto-provision users</p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        Automatically create accounts for new SSO users
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-[var(--border-default)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setConfigStep(2)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => setActiveProvider(null)}>
                    Enable SSO
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
          <CardDescription>Additional authentication security options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[var(--surface-ground)] rounded-lg">
            <div>
              <p className="font-medium text-[var(--text-primary)]">Require Two-Factor Authentication</p>
              <p className="text-sm text-[var(--text-tertiary)]">
                All users must enable 2FA for their accounts
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--border-default)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--surface-ground)] rounded-lg">
            <div>
              <p className="font-medium text-[var(--text-primary)]">Session Timeout</p>
              <p className="text-sm text-[var(--text-tertiary)]">
                Automatically log out inactive users
              </p>
            </div>
            <select className="px-3 py-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]">
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>4 hours</option>
              <option>8 hours</option>
              <option>Never</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--surface-ground)] rounded-lg">
            <div>
              <p className="font-medium text-[var(--text-primary)]">IP Allowlist</p>
              <p className="text-sm text-[var(--text-tertiary)]">
                Restrict access to specific IP addresses
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
