"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { useToast } from "@/components/ui/Toast";
import { setAuthTokens, setTenantSubdomain } from "@/lib/api/client";
import {
  getKPIs,
  listAllUsers,
  listAllTenants,
  deleteUser,
  sendRecoveryEmail,
  assignCredits,
  impersonateTenant,
  suspendTenant,
  unsuspendTenant,
  type PlatformKPIs,
  type PlatformUser,
  type TenantListItem,
} from "@/lib/api/superadmin";
import {
  Shield,
  Users,
  FileText,
  TrendingUp,
  Building2,
  CreditCard,
  Activity,
  Search,
  Trash2,
  KeyRound,
  Coins,
  LogIn,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Ban,
  CheckCircle,
  X,
  Sparkles,
} from "lucide-react";

type Tab = "kpis" | "users" | "tenants";

interface CreditsModal {
  user: PlatformUser;
  credits: string;
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("kpis");
  const [loading, setLoading] = useState(true);

  // KPI state
  const [kpis, setKpis] = useState<PlatformKPIs | null>(null);

  // Users state
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersStatus, setUsersStatus] = useState<"all" | "active" | "suspended" | "deleted">("all");
  const [usersLoading, setUsersLoading] = useState(false);

  // Tenants state
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [tenantsPage, setTenantsPage] = useState(1);
  const [tenantsTotalPages, setTenantsTotalPages] = useState(1);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  // Modal state
  const [creditsModal, setCreditsModal] = useState<CreditsModal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlatformUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Guard: only super admins
  useEffect(() => {
    if (user && !user.is_super_admin) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // Load KPIs on mount
  const fetchKPIs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getKPIs();
      setKpis(data);
    } catch (err) {
      console.error("Failed to fetch KPIs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_super_admin) {
      fetchKPIs();
    }
  }, [user, fetchKPIs]);

  // Load users
  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const data = await listAllUsers({
        page: usersPage,
        limit: 20,
        search: usersSearch || undefined,
        status: usersStatus,
      });
      setUsers(data.users);
      setUsersTotalPages(data.pagination.totalPages);
      setUsersTotal(data.pagination.total);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage, usersSearch, usersStatus]);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  // Load tenants
  const fetchTenants = useCallback(async () => {
    try {
      setTenantsLoading(true);
      const data = await listAllTenants({ page: tenantsPage, limit: 50 });
      setTenants(data.tenants);
      setTenantsTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error("Failed to fetch tenants:", err);
    } finally {
      setTenantsLoading(false);
    }
  }, [tenantsPage]);

  useEffect(() => {
    if (activeTab === "tenants") {
      fetchTenants();
    }
  }, [activeTab, fetchTenants]);

  // Actions
  const handleDeleteUser = async (targetUser: PlatformUser) => {
    setActionLoading(targetUser.id);
    try {
      await deleteUser(targetUser.id);
      addToast({ type: "success", title: `Deleted ${targetUser.email}` });
      setConfirmDelete(null);
      fetchUsers();
    } catch (err: any) {
      addToast({ type: "error", title: err.message || "Failed to delete user" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendRecovery = async (targetUser: PlatformUser) => {
    setActionLoading(`recovery-${targetUser.id}`);
    try {
      await sendRecoveryEmail(targetUser.id);
      addToast({ type: "success", title: `Recovery email sent to ${targetUser.email}` });
    } catch (err: any) {
      addToast({ type: "error", title: err.message || "Failed to send recovery email" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignCredits = async () => {
    if (!creditsModal) return;
    const amount = parseInt(creditsModal.credits);
    if (isNaN(amount) || amount < 1) {
      addToast({ type: "error", title: "Enter a valid number of credits" });
      return;
    }
    setActionLoading(`credits-${creditsModal.user.id}`);
    try {
      const result = await assignCredits(creditsModal.user.id, amount);
      addToast({ type: "success", title: result.message });
      setCreditsModal(null);
    } catch (err: any) {
      addToast({ type: "error", title: err.message || "Failed to assign credits" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleImpersonate = async (tenantId: string, tenantName: string) => {
    setActionLoading(`impersonate-${tenantId}`);
    try {
      // Store current superadmin credentials for restore
      const currentAccessToken = localStorage.getItem("access_token");
      const currentRefreshToken = localStorage.getItem("refresh_token");
      const currentSubdomain = localStorage.getItem("tenant_subdomain");
      if (currentAccessToken && currentRefreshToken) {
        localStorage.setItem("sa_access_token", currentAccessToken);
        localStorage.setItem("sa_refresh_token", currentRefreshToken);
        if (currentSubdomain) localStorage.setItem("sa_tenant_subdomain", currentSubdomain);
      }

      const result = await impersonateTenant(tenantId);

      // Set impersonated tokens
      setAuthTokens(result.access_token, result.refresh_token);
      setTenantSubdomain(result.tenant.subdomain);
      localStorage.setItem("impersonating", "true");
      localStorage.setItem("impersonating_tenant_name", tenantName);

      addToast({ type: "success", title: `Switched to workspace: ${tenantName}` });

      // Reload to apply new context
      window.location.href = "/dashboard";
    } catch (err: any) {
      addToast({ type: "error", title: err.message || "Failed to switch workspace" });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (!user?.is_super_admin) {
    return null;
  }

  const kpiCards = kpis
    ? [
        { label: "Total Tenants", value: kpis.totalTenants, icon: Building2, color: "#8b5cf6" },
        { label: "Total Users", value: kpis.totalUsers, icon: Users, color: "#3b82f6" },
        { label: "Active Users (7d)", value: kpis.activeUsers7d, icon: Activity, color: "#10b981" },
        { label: "Total Documents", value: kpis.totalDocuments, icon: FileText, color: "#f59e0b" },
        { label: "New Users (30d)", value: kpis.newUsersLast30d, icon: TrendingUp, color: "#06b6d4" },
        { label: "New Docs (30d)", value: kpis.newDocsLast30d, icon: FileText, color: "#ec4899" },
        { label: "AI Queries (30d)", value: kpis.aiQueriesLast30d, icon: Sparkles, color: "#8b5cf6" },
        { label: "Credits Used", value: `${kpis.totalCreditsUsed} / ${kpis.totalCreditsAllocated}`, icon: CreditCard, color: "#ef4444", subtitle: `${kpis.creditUtilization}% utilization` },
      ]
    : [];

  return (
    <div className="min-h-full flex flex-col space-y-8 pb-4">
      {/* Header */}
      <DashboardPageHeader
        title={
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)] flex items-center gap-2">
            <Shield className="w-6 h-6 text-[var(--brand)]" />
            Platform Admin
          </h1>
        }
        description={
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Manage platform KPIs, users and tenant workspaces
          </p>
        }
        right={
          <button
            onClick={() => { fetchKPIs(); if (activeTab === "users") fetchUsers(); if (activeTab === "tenants") fetchTenants(); }}
            className="flex items-center gap-2 h-10 px-5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-secondary)] hover:border-[var(--brand)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg p-1.5 w-fit mx-auto">
        {([
          { id: "kpis" as Tab, label: "KPIs", icon: TrendingUp },
          { id: "users" as Tab, label: "Users", icon: Users },
          { id: "tenants" as Tab, label: "Tenants", icon: Building2 },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {/* ==================== KPIs TAB ==================== */}
        {activeTab === "kpis" && (
          <div className="space-y-8">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpiCards.map((kpi) => (
                  <div key={kpi.label} className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[var(--dash-text-tertiary)]">{kpi.label}</p>
                        <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-1">
                          {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
                        </p>
                        {"subtitle" in kpi && kpi.subtitle && (
                          <p className="text-xs text-[var(--dash-text-muted)] mt-1">{kpi.subtitle}</p>
                        )}
                      </div>
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${kpi.color}15` }}
                      >
                        <kpi.icon className="w-6 h-6" style={{ color: kpi.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== USERS TAB ==================== */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={usersSearch}
                  onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <select
                value={usersStatus}
                onChange={(e) => { setUsersStatus(e.target.value as any); setUsersPage(1); }}
                className="px-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)]"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deleted">Deleted</option>
              </select>
              <span className="text-sm text-[var(--dash-text-muted)]">
                {usersTotal} user{usersTotal !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Table */}
            <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
              {usersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-16 text-[var(--dash-text-muted)] text-sm">No users found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--dash-border-subtle)]">
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">User</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Tenant</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Role</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Last Active</th>
                        <th className="text-right px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dash-border-subtle)]">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-[var(--dash-text-primary)]">{u.full_name || "—"}</p>
                              <p className="text-xs text-[var(--dash-text-muted)]">{u.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[var(--dash-text-secondary)]">{u.tenant_name}</span>
                            <p className="text-xs text-[var(--dash-text-muted)]">{u.tenant_subdomain}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.is_super_admin
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                : u.role === "admin"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}>
                              {u.is_super_admin ? "Super Admin" : u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : u.status === "suspended"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                            {formatDate(u.last_active_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {/* Send Recovery */}
                              <button
                                onClick={() => handleSendRecovery(u)}
                                disabled={actionLoading === `recovery-${u.id}` || u.status === "deleted"}
                                className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-[var(--brand)] transition-colors disabled:opacity-30"
                                title="Send password recovery"
                              >
                                {actionLoading === `recovery-${u.id}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <KeyRound className="w-4 h-4" />
                                )}
                              </button>
                              {/* Assign Credits */}
                              <button
                                onClick={() => setCreditsModal({ user: u, credits: "" })}
                                disabled={u.status === "deleted"}
                                className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-emerald-500 transition-colors disabled:opacity-30"
                                title="Assign AI credits"
                              >
                                <Coins className="w-4 h-4" />
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => setConfirmDelete(u)}
                                disabled={u.is_super_admin || u.status === "deleted"}
                                className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-red-500 transition-colors disabled:opacity-30"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {usersTotalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                  disabled={usersPage === 1}
                  className="p-2 rounded-lg hover:bg-[var(--surface-card)] text-[var(--dash-text-muted)] disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-[var(--dash-text-secondary)]">
                  Page {usersPage} of {usersTotalPages}
                </span>
                <button
                  onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                  disabled={usersPage === usersTotalPages}
                  className="p-2 rounded-lg hover:bg-[var(--surface-card)] text-[var(--dash-text-muted)] disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================== TENANTS TAB ==================== */}
        {activeTab === "tenants" && (
          <div className="space-y-6">
            <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
              {tenantsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
                </div>
              ) : tenants.length === 0 ? (
                <div className="text-center py-16 text-[var(--dash-text-muted)] text-sm">No tenants found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--dash-border-subtle)]">
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Workspace</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Tier</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Users</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Docs</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Credits</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Last Active</th>
                        <th className="text-right px-4 py-3 font-medium text-[var(--dash-text-tertiary)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dash-border-subtle)]">
                      {tenants.map((t) => (
                        <tr key={t.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-[var(--dash-text-primary)]">{t.name}</p>
                              <p className="text-xs text-[var(--dash-text-muted)]">{t.subdomain}.tynebase.com</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              t.tier === "enterprise"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                : t.tier === "pro"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : t.tier === "base"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}>
                              {t.tier}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--dash-text-secondary)]">{t.userCount}</td>
                          <td className="px-4 py-3 text-[var(--dash-text-secondary)]">{t.documentCount}</td>
                          <td className="px-4 py-3">
                            <span className="text-[var(--dash-text-secondary)]">
                              {t.creditsUsed} / {t.creditsTotal}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--dash-text-muted)]">{formatDate(t.lastActive)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleImpersonate(t.id, t.name)}
                                disabled={actionLoading === `impersonate-${t.id}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand)]/10 text-[var(--brand)] hover:bg-[var(--brand)]/20 text-xs font-medium transition-colors disabled:opacity-50"
                                title="Switch to this workspace"
                              >
                                {actionLoading === `impersonate-${t.id}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <LogIn className="w-3.5 h-3.5" />
                                )}
                                Enter Workspace
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {tenantsTotalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setTenantsPage((p) => Math.max(1, p - 1))}
                  disabled={tenantsPage === 1}
                  className="p-2 rounded-lg hover:bg-[var(--surface-card)] text-[var(--dash-text-muted)] disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-[var(--dash-text-secondary)]">
                  Page {tenantsPage} of {tenantsTotalPages}
                </span>
                <button
                  onClick={() => setTenantsPage((p) => Math.min(tenantsTotalPages, p + 1))}
                  disabled={tenantsPage === tenantsTotalPages}
                  className="p-2 rounded-lg hover:bg-[var(--surface-card)] text-[var(--dash-text-muted)] disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== CREDITS MODAL ==================== */}
      {creditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCreditsModal(null)} />
          <div className="relative w-full max-w-md bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-500" />
                Assign AI Credits
              </h2>
              <button onClick={() => setCreditsModal(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[var(--dash-text-secondary)]">
                Add credits to <strong>{creditsModal.user.email}</strong>&apos;s tenant credit pool
                ({creditsModal.user.tenant_name}).
              </p>
              <input
                type="number"
                min="1"
                max="100000"
                placeholder="Number of credits..."
                value={creditsModal.credits}
                onChange={(e) => setCreditsModal({ ...creditsModal, credits: e.target.value })}
                className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                autoFocus
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setCreditsModal(null)}
                  className="px-4 py-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignCredits}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                  Assign Credits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRM MODAL ==================== */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-md bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <h2 className="text-lg font-semibold text-red-500 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Confirm Delete
              </h2>
              <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[var(--dash-text-secondary)]">
                Are you sure you want to delete <strong>{confirmDelete.email}</strong>?
                This will soft-delete the user, blocking their access.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteUser(confirmDelete)}
                  disabled={actionLoading === confirmDelete.id}
                  className="flex items-center gap-2 px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading === confirmDelete.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
