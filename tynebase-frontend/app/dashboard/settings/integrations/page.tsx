"use client";

import React from 'react';
import { Plug, Slack, Github, Zap, Globe, Key, Webhook } from 'lucide-react';

const INTEGRATIONS = [
  { name: 'Slack', icon: Slack, description: 'Get notifications and share content in Slack channels', category: 'Communication' },
  { name: 'GitHub', icon: Github, description: 'Sync documents with GitHub repositories', category: 'Development' },
  { name: 'Zapier', icon: Zap, description: 'Connect with 3 000+ apps via Zapier automation', category: 'Automation' },
  { name: 'Webhooks', icon: Globe, description: 'Receive real-time events at your own endpoints', category: 'Developer' },
  { name: 'API Keys', icon: Key, description: 'Programmatic access to your TyneBase workspace', category: 'Developer' },
];

export default function IntegrationsSettings() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--dash-text-primary)]">Integrations</h1>
        <p className="text-[var(--dash-text-secondary)] mt-1">
          Connect TyneBase with your favourite tools and services
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="flex items-start gap-4 p-5 rounded-xl bg-[var(--brand)]/8 border border-[var(--brand)]/20">
        <div className="w-10 h-10 rounded-lg bg-[var(--brand)]/15 flex items-center justify-center flex-shrink-0">
          <Plug className="w-5 h-5 text-[var(--brand)]" />
        </div>
        <div>
          <p className="font-semibold text-[var(--dash-text-primary)]">Integrations coming soon</p>
          <p className="text-sm text-[var(--dash-text-secondary)] mt-0.5">
            We're building first-class integrations with the tools your team already uses.
            They'll appear here as soon as they're ready.
          </p>
        </div>
      </div>

      {/* Grid of upcoming integrations */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map(({ name, icon: Icon, description, category }) => (
          <div
            key={name}
            className="flex flex-col gap-3 p-5 rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] opacity-60 select-none"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--surface-ground)] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[var(--dash-text-muted)]" />
                </div>
                <div>
                  <p className="font-medium text-sm text-[var(--dash-text-primary)]">{name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--dash-text-muted)] font-semibold">{category}</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[var(--surface-ground)] text-[var(--dash-text-muted)] border border-[var(--dash-border-subtle)]">
                Soon
              </span>
            </div>
            <p className="text-xs text-[var(--dash-text-secondary)]">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
