"use client";

import { useState, useEffect } from "react";
import { listUsers, updateUser, deleteUser, User } from "@/lib/api/users";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  UserCog,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  Send,
  Info,
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  ShieldOff,
  Crown,
  ArrowRight
} from "lucide-react";
import { inviteUser, listPendingInvites, cancelInvite, resendInvite, PendingInvite } from "@/lib/api/invites";
import { useToast } from "@/components/ui/Toast";
import { TIER_CONFIG, TierType } from "@/types/api";
import Link from "next/link";

const roleColors: Record<string, string> = {
  admin: "bg-purple-500/10 text-purple-600",
  editor: "bg-blue-500/10 text-blue-600",
  viewer: "bg-gray-500/10 text-gray-600",
};

function getRoleBadgeClass(role: string) {
  return roleColors[role] ?? "bg-gray-500/10 text-gray-600";
}

function UsersPageHeader({ onInvite, onShowRoles, canInvite, tier }: { onInvite: () => void; onShowRoles: () => void; canInvite: boolean; tier: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Team Members</h1>
        <p className="text-[var(--text-tertiary)] mt-1 flex items-center gap-2">
          Manage your workspace members and their permissions
          <button onClick={onShowRoles} className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline text-sm font-medium">
            <Info className="w-3.5 h-3.5" />
            View Roles
          </button>
        </p>
      </div>
      <div className="flex items-center gap-3">
        {canInvite ? (
          <Button variant="primary" className="gap-2 px-6" onClick={onInvite}>
            <Plus className="w-4 h-4" />
            Invite Member
          </Button>
        ) : (
          <Link href="/dashboard/settings/billing">
            <Button variant="primary" className="gap-2 px-6">
              <Crown className="w-4 h-4" />
              Upgrade to Invite
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function UsersStats({ totalCount, activeCount, pendingCount }: { totalCount: number; activeCount: number; pendingCount: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{totalCount}</p>
              <p className="text-sm text-[var(--text-tertiary)]">Total Members</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{activeCount}</p>
              <p className="text-sm text-[var(--text-tertiary)]">Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{pendingCount}</p>
              <p className="text-sm text-[var(--text-tertiary)]">Pending Invites</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">3</p>
              <p className="text-sm text-[var(--text-tertiary)]">Roles</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersFiltersBar({
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3 lg:flex-1 lg:min-w-0">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-tertiary)]" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" className="gap-2 px-5">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>
    </div>
  );
}

function MembersCard({ membersCount, children }: { membersCount: number; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col min-h-0 flex-1">
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          {membersCount} member{membersCount !== 1 ? "s" : ""} found
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        <div className="divide-y divide-[var(--border-subtle)] overflow-visible">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingInvitesCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-amber-500" />
          Pending Invitations
        </CardTitle>
        <CardDescription>Invitations that haven't been accepted yet</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[var(--border-subtle)]">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export default function UsersPage() {
  const { addToast } = useToast();
  const { user: currentUser, tenant } = useAuth();
  
  // Tier-based invite gating
  const tenantTier = (tenant?.tier || 'free') as TierType;
  const tierConfig = TIER_CONFIG[tenantTier];
  const canInviteMembers = tierConfig.maxUsers > 1; // Free tier = 1 user, can't invite

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  
  // Role change modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  // Delete confirmation modal state
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Pending invites state
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Admin guard - check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const response = await listUsers();
        setUsers(response.users);
      } catch (err: any) {
        console.error('Failed to fetch users:', err);
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  // Fetch pending invites
  useEffect(() => {
    async function fetchPendingInvites() {
      if (!isAdmin) return;
      try {
        setLoadingInvites(true);
        const response = await listPendingInvites();
        setPendingInvites(response.invites);
      } catch (err: any) {
        console.error('Failed to fetch pending invites:', err);
      } finally {
        setLoadingInvites(false);
      }
    }
    fetchPendingInvites();
  }, [isAdmin]);

  const filteredMembers = users.filter((user) => {
    const matchesSearch =
      (user.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeCount = users.filter(u => u.status === "active").length;
  const suspendedCount = users.filter(u => u.status === "suspended").length;

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      setInviting(true);
      await inviteUser({ email: inviteEmail.trim(), role: inviteRole });
      addToast({ type: "success", title: "Invitation sent", description: `Invitation sent to ${inviteEmail}` });
      const response = await listPendingInvites();
      setPendingInvites(response.invites);
      
      setInviteEmail("");
      setShowInviteModal(false);
    } catch (err: any) {
      console.error('Failed to send invite:', err);
      addToast({ type: "error", title: "Invitation failed", description: err.message || "Failed to send invitation. Please try again." });
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = (member: User) => {
    setEditingUser(member);
    setEditRole(member.role);
    setUpdateError(null);
    setActiveDropdownId(null);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      setUpdating(true);
      setUpdateError(null);
      const response = await updateUser(editingUser.id, { role: editRole });
      
      // Update local state
      setUsers(users.map(u => u.id === editingUser.id ? response.user : u));
      setEditingUser(null);
      addToast({ type: "success", title: "Role updated", description: `${editingUser.full_name || editingUser.email}'s role has been updated to ${editRole}` });
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setUpdateError(err.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClick = (member: User) => {
    setDeletingUser(member);
    setDeleteError(null);
    setActiveDropdownId(null);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    
    try {
      setDeleting(true);
      setDeleteError(null);
      await deleteUser(deletingUser.id);
      
      // Remove from local state
      setUsers(users.filter(u => u.id !== deletingUser.id));
      setDeletingUser(null);
      addToast({ type: "success", title: "User removed", description: `${deletingUser.full_name || deletingUser.email} has been removed from the workspace` });
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setDeleteError(err.message || 'Failed to remove user');
    } finally {
      setDeleting(false);
    }
  };

  const handleResendInvite = async (invite: PendingInvite) => {
    try {
      setResendingId(invite.id);
      await resendInvite(invite.id);
      addToast({ type: "success", title: "Invitation resent", description: `Invitation resent to ${invite.email}` });
    } catch (err: any) {
      console.error('Failed to resend invite:', err);
      addToast({ type: "error", title: "Resend failed", description: err.message || "Failed to resend invitation" });
    } finally {
      setResendingId(null);
    }
  };

  const handleCancelInvite = async (invite: PendingInvite) => {
    try {
      setCancellingId(invite.id);
      await cancelInvite(invite.id);
      setPendingInvites(pendingInvites.filter(i => i.id !== invite.id));
      addToast({ type: "success", title: "Invitation cancelled", description: `Invitation to ${invite.email} has been cancelled` });
    } catch (err: any) {
      console.error('Failed to cancel invite:', err);
      addToast({ type: "error", title: "Cancel failed", description: err.message || "Failed to cancel invitation" });
    } finally {
      setCancellingId(null);
    }
  };

  const handleSendEmail = (member: User) => {
    window.location.href = `mailto:${member.email}`;
  };

  const handleMoreOptions = (memberId: string) => {
    setActiveDropdownId(activeDropdownId === memberId ? null : memberId);
  };

  // Admin guard - show permission denied for non-admins
  if (!isAdmin) {
    return (
      <div className="w-full h-full min-h-0 flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
          <ShieldOff className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Access Denied</h1>
          <p className="text-[var(--text-tertiary)]">
            You don't have permission to access user management. Only administrators can view and manage team members.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-8">
      {/* Free tier upgrade banner */}
      {tenantTier === 'free' && (
        <div className="bg-gradient-to-r from-[#E85002] to-[#8b5cf6] rounded-xl p-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Free plan — 1 user only</h3>
                <p className="text-white/80 text-sm mt-0.5">Upgrade to Base or Pro to invite team members and collaborate.</p>
              </div>
            </div>
            <Link
              href="/dashboard/settings/billing"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#E85002] rounded-xl font-semibold hover:bg-white/90 transition-colors shadow-md whitespace-nowrap"
            >
              Upgrade Plan
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      <UsersPageHeader onInvite={() => setShowInviteModal(true)} onShowRoles={() => setShowRolesModal(true)} canInvite={canInviteMembers} tier={tenantTier} />

      <UsersStats totalCount={users.length} activeCount={activeCount} pendingCount={pendingInvites.length} />

      <UsersFiltersBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
      />

      <div className="flex flex-col gap-6 min-h-0 flex-1">
        <MembersCard membersCount={filteredMembers.length}>
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-4 px-5 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--surface-ground)] transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <Avatar alt={member.full_name || member.email} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">{member.full_name || member.email.split('@')[0]}</p>
                    {member.status === "suspended" && (
                      <span className="px-2 py-0.5 text-xs bg-red-500/10 text-red-600 rounded-full flex-shrink-0">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-tertiary)] truncate">{member.email}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <div className="text-left sm:text-right">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeClass(member.role)}`}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-left sm:text-right w-24">
                    <p className="text-sm text-[var(--text-primary)]">{member.documents_count ?? 0}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Documents</p>
                  </div>
                  <div className="text-left sm:text-right w-28">
                    <p className="text-sm text-[var(--text-secondary)]">{member.last_active_at ? new Date(member.last_active_at).toLocaleDateString() : 'Never'}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Last active</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="ghost" size="icon-sm" title="Change role" onClick={() => handleChangeRole(member)}>
                    <UserCog className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Send email" onClick={() => handleSendEmail(member)}>
                    <Mail className="w-4 h-4" />
                  </Button>
                  <div className="relative">
                    <Button variant="ghost" size="icon-sm" title="More options" onClick={() => handleMoreOptions(member.id)}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                    {activeDropdownId === member.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-lg z-50 py-1">
                        <button onClick={() => { handleChangeRole(member); setActiveDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-ground)] flex items-center gap-2">
                          <UserCog className="w-4 h-4" /> Change Role
                        </button>
                        <button onClick={() => { handleSendEmail(member); setActiveDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-ground)] flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Send Email
                        </button>
                        {member.id !== currentUser?.id && (
                          <>
                            <div className="h-px bg-[var(--border-subtle)] my-1" />
                            <button onClick={() => handleDeleteClick(member)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 className="w-4 h-4" /> Remove User
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </MembersCard>

        {/* Pending Invitations Card */}
        {pendingInvites.length > 0 && (
          <PendingInvitesCard>
            {loadingInvites ? (
              <div className="px-6 py-8 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
              </div>
            ) : (
              pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--surface-ground)] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">{invite.email}</p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        Invited as <span className={`font-medium ${getRoleBadgeClass(invite.role)} px-1.5 py-0.5 rounded text-xs`}>{invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}</span> by {invite.invited_by}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {new Date(invite.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleResendInvite(invite)}
                      disabled={resendingId === invite.id}
                    >
                      {resendingId === invite.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 gap-1.5"
                      onClick={() => handleCancelInvite(invite)}
                      disabled={cancellingId === invite.id}
                    >
                      {cancellingId === invite.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      Cancel
                    </Button>
                  </div>
                </div>
              ))
            )}
          </PendingInvitesCard>
        )}

      </div>

      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Team Member"
        description="Send an invitation to join your workspace"
        size="md"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Email Address
            </label>
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "editor" | "viewer")}
              className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="editor">Editor - Can create and edit workspace content</option>
              <option value="admin">Admin - Can manage members and workspace settings</option>
            </select>
          </div>

          <div className="bg-[var(--surface-ground)] rounded-lg p-5 text-sm text-[var(--text-tertiary)]">
            <p>An invitation email will be sent to this address. They'll be able to join your workspace once they accept.</p>
          </div>
        </div>

        <ModalFooter className="gap-4">
          <Button variant="ghost" className="px-6" onClick={() => setShowInviteModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" className="gap-2 px-6" onClick={handleSendInvite} disabled={inviting || !inviteEmail.trim()}>
            <Send className="w-4 h-4" />
            {inviting ? 'Sending...' : 'Send Invite'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Role Change Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Change Role"
        description={editingUser ? `Update role for ${editingUser.full_name || editingUser.email}` : ''}
        size="md"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Role
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as "admin" | "editor" | "viewer")}
              className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="editor">Editor - Can create and edit workspace content</option>
              <option value="admin">Admin - Can manage members and workspace settings</option>
            </select>
          </div>
          {updateError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {updateError}
            </div>
          )}
        </div>
        <ModalFooter className="gap-4">
          <Button variant="ghost" className="px-6" onClick={() => setEditingUser(null)}>
            Cancel
          </Button>
          <Button variant="primary" className="gap-2 px-6" onClick={handleUpdateUser} disabled={updating}>
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
            {updating ? 'Saving...' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        title="Remove User"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">
              This will remove <strong>{deletingUser?.full_name || deletingUser?.email}</strong> from your workspace. This action cannot be undone.
            </p>
          </div>
          {deleteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {deleteError}
            </div>
          )}
        </div>
        <ModalFooter className="gap-4">
          <Button variant="ghost" className="px-6" onClick={() => setDeletingUser(null)}>
            Cancel
          </Button>
          <Button variant="destructive" className="gap-2 px-6" onClick={handleDeleteUser} disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Removing...' : 'Remove User'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Roles Info Modal */}
      {showRolesModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRolesModal(false)} />
          <div className="relative w-full max-w-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">User Roles & Permissions</h2>
              <button onClick={() => setShowRolesModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] text-sm">Admin</h3>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">Can manage members, invites, billing, branding settings, and the rest of the workspace while also creating and editing content.</p>
              </div>
              <div className="h-px bg-[var(--border-subtle)]" />
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] text-sm">Editor</h3>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">Can create and edit documents, discussions, polls, tags, and other workspace content, but cannot manage members or workspace settings.</p>
              </div>
              <div className="h-px bg-[var(--border-subtle)]" />
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] text-sm">Viewer</h3>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">Read-only access. Can view workspace content but cannot create, edit, vote, or delete anything.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
