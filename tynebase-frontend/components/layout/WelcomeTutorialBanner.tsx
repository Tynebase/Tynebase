"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Sparkles, BookOpen, ArrowRight, Rocket } from "lucide-react";

const STORAGE_KEY = "tynebase_tutorial_dismissed";

export function WelcomeTutorialBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--brand)]/30 bg-gradient-to-r from-[var(--brand)]/5 via-purple-500/5 to-blue-500/5">
      {/* Decorative gradient blur */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-6 sm:p-8">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Icon */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--brand)] to-purple-600 text-white shadow-lg shadow-[var(--brand)]/20 flex-shrink-0">
            <Rocket className="w-6 h-6" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-1">
              Welcome to TyneBase!
            </h2>
            <p className="text-sm text-[var(--dash-text-secondary)] mb-4 max-w-xl">
              New here? Follow our quick tutorial to learn how to create documents, use AI features,
              collaborate with your team, and publish your knowledge base.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/docs"
                onClick={() => {
                  // Set a flag so the docs page opens the tutorial article
                  sessionStorage.setItem("tynebase_open_tutorial", "true");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                Start Tutorial
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <Link
                href="/dashboard/knowledge/new"
                className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--dash-border-subtle)] hover:border-[var(--brand)] text-[var(--dash-text-secondary)] hover:text-[var(--brand)] rounded-lg text-sm font-medium transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Create First Document
              </Link>

              <button
                onClick={dismiss}
                className="text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>

        {/* Quick tips row */}
        <div className="mt-5 pt-4 border-t border-[var(--dash-border-subtle)] grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "1", label: "Create a document", desc: "Write or generate with AI" },
            { icon: "2", label: "Organise & publish", desc: "Add categories, hit publish" },
            { icon: "3", label: "Share your KB", desc: "yourcompany.tynebase.com/docs" },
          ].map((step) => (
            <div key={step.icon} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                {step.icon}
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--dash-text-primary)]">{step.label}</p>
                <p className="text-[10px] text-[var(--dash-text-muted)]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
