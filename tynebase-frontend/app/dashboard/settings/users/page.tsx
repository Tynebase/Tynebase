"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { UserPlus, Shield, Crown, MoreHorizontal, Mail, Search, Loader2, Edit3, Trash2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { listUsers, updateUser, deleteUser, User } from "@/lib/api/users";
import { inviteUser } from "@/lib/api/invites";
import { DropdownMenu, DropdownItem, DropdownDivider } from "@/components/ui/Dropdown";

const roles = [
  { id: "admin", label: "Admin", description: "Full access, user management, settings, publishing", color: "#f97316" },
  { id: "editor", label: "Editor", description: "Create, edit, publish content, moderate community", color: "#3b82f6" },
  { id: "contributor", label: "Contributor", description: "Create and edit own content", color: "#10b981" },
  { id: "viewer", label: "View Only", description: "Read-only access to published content", color: "#6b7280" },
];


export default function UsersPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  
  // Edit user modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "editor" | "member" | "viewer">("member");
  const [editStatus, setEditStatus] = useState<"active" | "suspended">("active");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  // Delete confirmation modal state
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    
    try {
      setInviting(true);
      setInviteError(null);
      await inviteUser({ email: inviteEmail.trim(), role: inviteRole });
      setInviteSuccess(true);
      setInviteEmail("");
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error('Failed to invite user:', err);
      setInviteError(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditStatus(user.status as "active" | "suspended");
    setUpdateError(null);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      setUpdating(true);
      setUpdateError(null);
      const response = await updateUser(editingUser.id, { 
        role: editRole, 
        status: editStatus 
      });
      
      // Update local state
      setUsers(users.map(u => u.id === editingUser.id ? response.user : u));
      setEditingUser(null);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setUpdateError(err.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setDeleteError(null);
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
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setDeleteError(err.message || 'Failed to remove user');
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    const found = roles.find(r => r.id === role);
    return found?.color || "#6b7280";
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Users</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Manage team members and permissions
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowInviteModal(true)}>
          <UserPlus className="w-4 h-4" />
          Invite User
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader className="border-b border-[var(--dash-border-subtle)] pb-4">
          <CardTitle className="text-base font-semibold">Team Members</CardTitle>
          <CardDescription>People who have access to this workspace</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--dash-border-subtle)]">
            {/* Current User */}
            <div className="px-6 py-4 flex items-center justify-between bg-[var(--brand-primary-muted)]/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--brand)] flex items-center justify-center text-white font-semibold">
                  {user?.full_name?.split(" ").map(n => n[0]).join("") || "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[var(--dash-text-primary)]">{user?.full_name || "You"}</p>
                    <span className="px-2 py-0.5 text-xs font-medium bg-[var(--status-info-bg)] text-[var(--status-info)] rounded-full">You</span>
                  </div>
                  <p className="text-sm text-[var(--dash-text-muted)]">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1" style={{ backgroundColor: `${getRoleColor(user?.role || "admin")}15`, color: getRoleColor(user?.role || "admin") }}>
                  <Crown className="w-3 h-3" />
                  {user?.role || "Admin"}
                </span>
              </div>
            </div>

            {/* Other Users */}
            {loading ? (
              <div className="px-6 py-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
              </div>
            ) : filteredUsers.filter(u => u.id !== user?.id).map((member) => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--surface-ground)] flex items-center justify-center text-[var(--dash-text-tertiary)] font-semibold">
                    {(member.full_name || member.email).split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--dash-text-primary)]">{member.full_name || member.email.split('@')[0]}</p>
                      {member.status === "suspended" && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-[var(--status-error-bg)] text-[var(--status-error)] rounded-full">Suspended</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--dash-text-muted)]">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[var(--dash-text-muted)]">{member.last_active_at ? new Date(member.last_active_at).toLocaleDateString() : 'Never'}</span>
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: `${getRoleColor(member.role)}15`, color: getRoleColor(member.role) }}>
                    {roles.find(r => r.id === member.role)?.label || member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                  <DropdownMenu
                    align="right"
                    trigger={
                      <button className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    }
                  >
                    <DropdownItem onClick={() => handleEditUser(member)} icon={<Edit3 className="w-4 h-4" />}>
                      Edit User
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem 
                      onClick={() => handleDeleteClick(member)} 
                      icon={<Trash2 className="w-4 h-4" />}
                      destructive
                    >
                      Remove User
                    </DropdownItem>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card>
        <CardHeader className="border-b border-[var(--dash-border-subtle)] pb-4">
          <CardTitle className="text-base font-semibold">Role Permissions</CardTitle>
          <CardDescription>Overview of role capabilities</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => (
              <Card key={role.id} className="hover:border-[var(--brand)] transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${role.color}15` }}>
                      <Shield className="w-4 h-4" style={{ color: role.color }} />
                    </div>
                    <span className="font-medium text-[var(--dash-text-primary)]">{role.label}</span>
                  </div>
                  <p className="text-sm text-[var(--dash-text-muted)]">{role.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Section */}
      <div className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-dark)] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Invite your team</h3>
            <p className="text-white/80 text-sm">Collaborate with your team on your knowledge base.</p>
          </div>
          <button 
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-white text-[var(--brand)] rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Invite users
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => { setShowInviteModal(false); setInviteError(null); setInviteSuccess(false); }}
        title="Invite Users"
        description="Send an invitation email to join your workspace"
        size="md"
      >
        {inviteSuccess ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">Invitation Sent!</h3>
            <p className="text-[var(--dash-text-muted)]">The invitation email has been sent successfully.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              >
                <option value="viewer">Viewer - Read-only access</option>
                <option value="member">Member - Create and edit own content</option>
                <option value="editor">Editor - Create, edit, publish content</option>
                <option value="admin">Admin - Full access</option>
              </select>
            </div>
            {inviteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {inviteError}
              </div>
            )}
          </div>
        )}
        {!inviteSuccess && (
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {inviting ? 'Sending...' : 'Send Invite'}
            </Button>
          </ModalFooter>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User"
        description={editingUser ? `Update role and status for ${editingUser.full_name || editingUser.email}` : ''}
        size="md"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Role
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as any)}
              className="w-full px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="member">Member - Create and edit own content</option>
              <option value="editor">Editor - Create, edit, publish content</option>
              <option value="admin">Admin - Full access</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Status
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as any)}
              className="w-full px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          {updateError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {updateError}
            </div>
          )}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleUpdateUser} disabled={updating}>
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
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
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeletingUser(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Removing...' : 'Remove User'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
