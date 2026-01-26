"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { 
  Shield, 
  Users, 
  Plus, 
  Check, 
  X,
  ChevronDown,
  ChevronRight,
  Lock,
  FileText,
  Settings,
  Sparkles,
  BarChart3
} from "lucide-react";

const roles = [
  {
    id: "admin",
    name: "Admin",
    description: "Full access to all features and settings",
    color: "brand",
    members: 2,
    isDefault: false,
  },
  {
    id: "editor",
    name: "Editor",
    description: "Can create, edit, and publish documents",
    color: "purple",
    members: 5,
    isDefault: false,
  },
  {
    id: "contributor",
    name: "Contributor",
    description: "Can create and edit own documents",
    color: "blue",
    members: 12,
    isDefault: true,
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to published content",
    color: "cyan",
    members: 24,
    isDefault: false,
  },
];

const permissionGroups = [
  {
    name: "Documents",
    icon: FileText,
    permissions: [
      { id: "docs.create", label: "Create documents", admin: true, editor: true, contributor: true, viewer: false },
      { id: "docs.edit_own", label: "Edit own documents", admin: true, editor: true, contributor: true, viewer: false },
      { id: "docs.edit_any", label: "Edit any document", admin: true, editor: true, contributor: false, viewer: false },
      { id: "docs.delete", label: "Delete documents", admin: true, editor: true, contributor: false, viewer: false },
      { id: "docs.publish", label: "Publish documents", admin: true, editor: true, contributor: false, viewer: false },
      { id: "docs.archive", label: "Archive documents", admin: true, editor: true, contributor: false, viewer: false },
    ],
  },
  {
    name: "AI Features",
    icon: Sparkles,
    permissions: [
      { id: "ai.generate", label: "Generate content", admin: true, editor: true, contributor: true, viewer: false },
      { id: "ai.video", label: "Process videos", admin: true, editor: true, contributor: false, viewer: false },
      { id: "ai.enhance", label: "Enhance documents", admin: true, editor: true, contributor: true, viewer: false },
    ],
  },
  {
    name: "Team Management",
    icon: Users,
    permissions: [
      { id: "team.view", label: "View team members", admin: true, editor: true, contributor: true, viewer: true },
      { id: "team.invite", label: "Invite members", admin: true, editor: false, contributor: false, viewer: false },
      { id: "team.remove", label: "Remove members", admin: true, editor: false, contributor: false, viewer: false },
      { id: "team.roles", label: "Change roles", admin: true, editor: false, contributor: false, viewer: false },
    ],
  },
  {
    name: "Analytics",
    icon: BarChart3,
    permissions: [
      { id: "analytics.view", label: "View analytics", admin: true, editor: true, contributor: false, viewer: false },
      { id: "analytics.export", label: "Export reports", admin: true, editor: false, contributor: false, viewer: false },
    ],
  },
  {
    name: "Settings",
    icon: Settings,
    permissions: [
      { id: "settings.view", label: "View settings", admin: true, editor: false, contributor: false, viewer: false },
      { id: "settings.edit", label: "Edit settings", admin: true, editor: false, contributor: false, viewer: false },
      { id: "branding.edit", label: "Edit branding", admin: true, editor: false, contributor: false, viewer: false },
    ],
  },
];

export default function PermissionsPage() {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Documents"]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Permissions</h1>
          <p className="text-[var(--text-tertiary)] mt-1">
            Manage roles and permissions for your team
          </p>
        </div>
        <Button variant="primary">
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Roles Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <Card 
            key={role.id} 
            className={`cursor-pointer transition-all ${
              selectedRole === role.id 
                ? "border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20" 
                : "hover:border-[var(--border-default)]"
            }`}
            onClick={() => setSelectedRole(role.id === selectedRole ? null : role.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center`}>
                  <Shield className={`w-5 h-5 text-[var(--brand)]`} />
                </div>
                {role.isDefault && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-[var(--surface-ground)] text-[var(--text-tertiary)] rounded-full">
                    Default
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-[var(--text-primary)]">{role.name}</h3>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">{role.description}</p>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <Users className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-sm text-[var(--text-secondary)]">{role.members} members</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Configure what each role can do in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Header */}
          <div className="flex items-center border-b border-[var(--border-subtle)] pb-3 mb-2">
            <div className="flex-1 font-medium text-[var(--text-secondary)]">Permission</div>
            <div className="flex items-center gap-2">
              {roles.map((role) => (
                <div 
                  key={role.id} 
                  className={`w-24 text-center text-sm font-medium ${
                    selectedRole === role.id 
                      ? `text-[var(--brand)]` 
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {role.name}
                </div>
              ))}
            </div>
          </div>

          {/* Permission Groups */}
          <div className="space-y-2">
            {permissionGroups.map((group) => {
              const isExpanded = expandedGroups.includes(group.name);
              const Icon = group.icon;
              
              return (
                <div key={group.name} className="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className="w-full flex items-center gap-3 p-3 bg-[var(--surface-ground)] hover:bg-[var(--surface-card)] transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
                    )}
                    <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="font-medium text-[var(--text-primary)]">{group.name}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {group.permissions.length} permissions
                    </span>
                  </button>
                  
                  {isExpanded && (
                    <div className="divide-y divide-[var(--border-subtle)]">
                      {group.permissions.map((perm) => (
                        <div key={perm.id} className="flex items-center p-3 hover:bg-[var(--surface-ground)] transition-colors">
                          <div className="flex-1 text-sm text-[var(--text-secondary)] pl-7">
                            {perm.label}
                          </div>
                          <div className="flex items-center gap-2">
                            {[
                              { role: "admin", has: perm.admin },
                              { role: "editor", has: perm.editor },
                              { role: "contributor", has: perm.contributor },
                              { role: "viewer", has: perm.viewer },
                            ].map((item) => (
                              <div key={item.role} className="w-24 flex justify-center">
                                <button
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                    item.has
                                      ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                                      : "bg-[var(--surface-ground)] text-[var(--text-tertiary)] hover:bg-[var(--surface-card)]"
                                  }`}
                                >
                                  {item.has ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-[var(--brand-primary)]/5 border-[var(--brand-primary)]/20">
        <CardContent className="p-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary)]/10 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-[var(--brand-primary)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Enterprise SSO & Custom Roles</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Need more granular control? Enterprise plans include SAML SSO, custom roles, and attribute-based access control.
            </p>
            <Button variant="outline" className="mt-3 text-sm h-8">
              Upgrade to Enterprise
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
