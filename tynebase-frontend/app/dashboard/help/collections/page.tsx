"use client";

import Link from "next/link";
import { ArrowLeft, Lock, Users, Globe } from "lucide-react";

export default function CollectionsHelpPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link
        href="/dashboard/help"
        className="inline-flex items-center gap-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--brand)] mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Help
      </Link>

      <h1 className="text-3xl font-bold text-[var(--dash-text-primary)] mb-4">
        Collections & Visibility
      </h1>

      <p className="text-[var(--dash-text-secondary)] mb-8">
        Collections let you group related documents. Visibility controls who can access them.
      </p>

      <div className="space-y-6">
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--dash-text-primary)]">Private (Default)</h2>
          </div>
          <p className="text-[var(--dash-text-secondary)] mb-3">
            Only you can see the collection. You can invite specific team members to view or edit.
          </p>
          <ul className="text-sm text-[var(--dash-text-tertiary)] space-y-1 list-disc list-inside">
            <li>Author can view, edit, delete</li>
            <li>Invited members: viewers can view, editors can add/remove documents</li>
            <li>Only author can invite/remove members</li>
          </ul>
        </div>

        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--dash-text-primary)]">Team</h2>
          </div>
          <p className="text-[var(--dash-text-secondary)] mb-3">
            All organisation members can view this collection.
          </p>
          <ul className="text-sm text-[var(--dash-text-tertiary)] space-y-1 list-disc list-inside">
            <li>All team members can view</li>
            <li>Only author can edit or delete</li>
          </ul>
        </div>

        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--dash-text-primary)]">Public</h2>
          </div>
          <p className="text-[var(--dash-text-secondary)] mb-3">
            Visible to all organisation members (same as Team in internal use).
          </p>
        </div>
      </div>

      <div className="mt-8 p-4 bg-[var(--surface-ground)] rounded-lg">
        <h3 className="font-semibold text-[var(--dash-text-primary)] mb-2">Changing Visibility</h3>
        <p className="text-sm text-[var(--dash-text-secondary)]">
          When changing from Private to Team/Public, existing invited members keep access and all team members gain view access. Only the author can edit or delete the collection.
        </p>
      </div>
    </div>
  );
}
