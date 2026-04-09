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
  restoreUser,
  sendRecoveryEmail,
  assignCredits,
  impersonateTenant,
  suspendTenant,
  unsuspendTenant,
  changeTenantTier,
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
  ArchiveX,
  KeyRound,
  Coins,
  LogIn,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  X,
  Sparkles,
  PauseCircle,
  PlayCircle,
  ArrowUpDown,
  UserCheck,
  RotateCcw,
} from "lucide-react";

type Tab = "kpis" | "users" | "tenants";

interface CreditsModal {
  user: PlatformUser;
  credits: string;
}

interface TierModal {
  tenant: TenantListItem;
  selectedTier: string;
  customCredits: string;
}

const TIERS = ["free", "base", "pro", "enterprise"] as const;

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
  const [usersStatus, setUsersStatus] = useState<"all" | "active" | "archived">("all");
  const [usersFilter, setUsersFilter] = useState<"all" | "new30d" | "active7d">("all");
  const [usersLoading, setUsersLoading] = useState(false);

  // Tenants state
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [tenantsPage, setTenantsPage] = useState(1);
  const [tenantsTotalPages, setTenantsTotalPages] = useState(1);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  // Modal state
  const [creditsModal, setCreditsModal] = useState<CreditsModal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlatformUser | null>(null);
  const [tierModal, setTierModal] = useState<TierModal | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<TenantListItem | null>(null);
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
        filter: usersFilter !== "all" ? usersFilter : undefined,
      });
      setUsers(data.users);
      setUsersTotalPages(data.pagination.totalPages);
      setUsersTotal(data.pagination.total);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage, usersSearch, usersStatus, usersFilter]);

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
      addToast({ type: "success", title: `${targetUser.email} has been archived successfully`, persistent: true });
      setConfirmDelete(null);
      fetchUsers();
    } catch (err: any) {
      addToast({ type: "error", title: err.message || "Failed to archive user" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreUser = async (targetUser: PlatformUser) => {
    setActionLoading(`restore-${targetUser.id}`);
    try {
      await restoreUser(targetUser.id);
      addToast({ type: "success", title: `${targetUser.email} has been re-instated`, persistent: true });
      fetchUsers();
    } catch (err: any) {
      addToast({ type: "error", title: err.message || "Failed to re-instate user" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendRecovery = async (targetUser: PlatformUser) => {
    setActionLoading(`recovery-${targetUser.id}`);
    try {
      await sendRecoveryEmail(targetUser.id);
      addToast({ type: "success", title: `Password recovery email sent to ${targetUser.email}` });
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
      await assignCredits(creditsModal.user.id, amount);
      addToast({ type: "success", title: `${amount} credits assigned to ${creditsModal.user.email}'s workspace` });
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

  const handleSuspendToggle = async (tenant: TenantListItem) => {
    const isArchived = (tenant as any).status === "archived" || (tenant as any).status === "deleted";
    setActionLoading(`suspend-${tenant.id}`);
    try {
      if (isArchived) {
        await unsuspendTenant(tenant.id);
        addToast({ type: "success", title: `Workspace "${tenant.name}" reactivated successfully` });
      } else {
        await suspendTenant(tenant.id);
        addToast({ type: "success", title: `Workspace "${tenant.name}" archived successfully` });
      }
      setConfirmSuspend(null);
      fetchTenants();
    } catch (error: any) {
      console.error("Failed to toggle tenant suspension:", error);
      const errorMessage = error?.message || "Failed to update workspace status";
      addToast({ type: "error", title: errorMessage });
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeTier = async () => {
    if (!tierModal) return;
    const customCredits = tierModal.customCredits ? parseInt(tierModal.customCredits) : undefined;
    if (tierModal.customCredits && (isNaN(customCredits!) || customCredits! < 1)) {
      addToast({ type: "error", title: "Enter a valid credit amount" });
      return;
    }
    setActionLoading(`tier-${tierModal.tenant.id}`);
    try {
      const result = await changeTenantTier(tierModal.tenant.id, tierModal.selectedTier, customCredits);
      addToast({ type: "success", title: result.message });
      setTierModal(null);
      fetchTenants();
    } catch (err: any) {
      addToast({ type: "error", title: err.message || "Failed to change tier" });
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

  if (!user?.is_super_admin) {
    return null;
  }

  const kpiCards = kpis
    ? [
        { label: "Total Tenants", value: kpis.totalTenants, icon: Building2, color: "#8b5cf6", glow: "rgba(139,92,246,0.15)" },
        { label: "Total Users", value: kpis.totalUsers, icon: Users, color: "#3b82f6", glow: "rgba(59,130,246,0.15)", onClick: () => { setActiveTab("users"); setUsersStatus("all"); setUsersFilter("all"); setUsersPage(1); } },
        { label: "Active Users (7d)", value: kpis.activeUsers7d, icon: Activity, color: "#10b981", glow: "rgba(16,185,129,0.15)", onClick: () => { setActiveTab("users"); setUsersStatus("active"); setUsersFilter("active7d"); setUsersPage(1); } },
        { label: "Total Documents", value: kpis.totalDocuments, icon: FileText, color: "#f59e0b", glow: "rgba(245,158,11,0.15)" },
        { label: "New Users (30d)", value: kpis.newUsersLast30d, icon: TrendingUp, color: "#06b6d4", glow: "rgba(6,182,212,0.15)", onClick: () => { setActiveTab("users"); setUsersStatus("active"); setUsersFilter("new30d"); setUsersPage(1); } },
        { label: "New Docs (30d)", value: kpis.newDocsLast30d, icon: FileText, color: "#ec4899", glow: "rgba(236,72,153,0.15)" },
        { label: "AI Queries (30d)", value: kpis.aiQueriesLast30d, icon: Sparkles, color: "#8b5cf6", glow: "rgba(139,92,246,0.15)" },
        { label: "Credits Used", value: `${kpis.totalCreditsUsed} / ${kpis.totalCreditsAllocated}`, icon: CreditCard, color: "#ef4444", glow: "rgba(239,68,68,0.15)", subtitle: `${kpis.creditUtilization}% utilization` },
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
      <div className="flex items-center bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-1.5 w-fit mx-auto shadow-sm">
        {([
          { id: "kpis" as Tab, label: "KPIs", icon: TrendingUp },
          { id: "users" as Tab, label: "Users", icon: Users },
          { id: "tenants" as Tab, label: "Tenants", icon: Building2 },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
              activeTab === tab.id
                ? "bg-[var(--brand)] text-white shadow-md"
                : "text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] hover:bg-[var(--surface-ground)]"
            }`}
            style={activeTab === tab.id ? { boxShadow: "0 0 12px rgba(var(--brand-rgb, 59,130,246), 0.35)" } : {}}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {kpiCards.map((kpi) => (
                  <div
                    key={kpi.label}
                    onClick={'onClick' in kpi ? kpi.onClick : undefined}
                    className={`relative bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 overflow-hidden transition-all duration-200 hover:border-opacity-60 group ${'onClick' in kpi ? 'cursor-pointer hover:border-[var(--brand)]/50' : ''}`}
                    style={{ boxShadow: `0 0 0 1px transparent` }}
                  >
                    {/* Top accent line */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ background: `linear-gradient(90deg, transparent, ${kpi.color}, transparent)` }}
                    />
                    {/* Subtle background glow */}
                    <div
                      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: `radial-gradient(ellipse at top right, ${kpi.glow}, transparent 70%)` }}
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wide">{kpi.label}</p>
                        <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-1.5 tabular-nums">
                          {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
                        </p>
                        {"subtitle" in kpi && kpi.subtitle && (
                          <p className="text-xs text-[var(--dash-text-muted)] mt-1">{kpi.subtitle}</p>
                        )}
                      </div>
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${kpi.color}18` }}
                      >
                        <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
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
                  onChange={(e) => { setUsersSearch(e.target.value); setUsersFilter("all"); setUsersPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <select
                value={usersStatus}
                onChange={(e) => { setUsersStatus(e.target.value as any); setUsersFilter("all"); setUsersPage(1); }}
                className="px-4 pr-8 py-2.5 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)]"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              {usersFilter !== "all" && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand)]/10 text-[var(--brand)] rounded-lg text-sm font-medium">
                  <span>
Filter: {usersFilter === "new30d" ? "New Users (30d)" : "Active Users (7d)"}</span>
                  <button
                    onClick={() => { setUsersFilter("all"); setUsersPage(1); }}
                    className="p-0.5 rounded hover:bg-[var(--brand)]/20 transition-colors"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
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
                      <tr className="border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]/40">
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">User</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Tenant</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Role</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Last Active</th>
                        <th className="text-right px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Actions</th>
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
                              {u.is_super_admin ? "Super Admin" : u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}>
                              {u.status === "deleted" ? "Deleted" : u.status ? u.status.charAt(0).toUpperCase() + u.status.slice(1) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                            {formatDate(u.last_active_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {/* Re-instate (archived users only) */}
                              {u.status === "archived" && (
                                <button
                                  onClick={() => handleRestoreUser(u)}
                                  disabled={actionLoading === `restore-${u.id}`}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 text-xs font-medium transition-colors disabled:opacity-30"
                                  title="Re-instate user (restore access)"
                                >
                                  {actionLoading === `restore-${u.id}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  )}
                                  Re-instate
                                </button>
                              )}
                              {/* Re-instate (deleted users only) */}
                              {u.status === "deleted" && (
                                <button
                                  onClick={() => handleRestoreUser(u)}
                                  disabled={actionLoading === `restore-${u.id}`}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 text-xs font-medium transition-colors disabled:opacity-30"
                                  title="Re-instate user (restore access)"
                                >
                                  {actionLoading === `restore-${u.id}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  )}
                                  Re-instate
                                </button>
                              )}
                              {/* Send Recovery Email (active users only) */}
                              {u.status !== "archived" && u.status !== "deleted" && (
                                <button
                                  onClick={() => handleSendRecovery(u)}
                                  disabled={actionLoading === `recovery-${u.id}`}
                                  className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-[var(--brand)] transition-colors disabled:opacity-30"
                                  title="Send password reset email"
                                >
                                  {actionLoading === `recovery-${u.id}` ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <KeyRound className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              {/* Assign Credits (active users only) */}
                              {u.status !== "archived" && (
                                <button
                                  onClick={() => setCreditsModal({ user: u, credits: "" })}
                                  disabled={u.is_super_admin}
                                  className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-emerald-500 transition-colors disabled:opacity-30"
                                  title={u.is_super_admin ? "Cannot assign credits to super admin" : "Assign AI credits"}
                                >
                                  <Coins className="w-4 h-4" />
                                </button>
                              )}
                              {/* Archive (soft-delete active users) */}
                              {u.status !== "archived" && !u.is_super_admin && (
                                <button
                                  onClick={() => setConfirmDelete(u)}
                                  className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-orange-500 transition-colors"
                                  title="Archive user (revoke access)"
                                >
                                  <ArchiveX className="w-4 h-4" />
                                </button>
                              )}
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
                      <tr className="border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)]/40">
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Workspace</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Tier</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Users</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Docs</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Credits</th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Last Active</th>
                        <th className="text-right px-4 py-3 font-medium text-[var(--dash-text-tertiary)] text-xs uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dash-border-subtle)]">
                      {tenants.map((t) => {
                        const isArchived = t.status === "archived" || t.status === "suspended";
                        return (
                        <tr key={t.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-[var(--dash-text-primary)]">{t.name}</p>
                              <p className="text-xs text-[var(--dash-text-muted)]">{t.subdomain}.tynebase.com</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setTierModal({ tenant: t, selectedTier: t.tier, customCredits: "" })}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors hover:ring-1 hover:ring-offset-1 ${
                                t.tier === "enterprise"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:ring-purple-400"
                                  : t.tier === "pro"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:ring-blue-400"
                                  : t.tier === "base"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:ring-green-400"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:ring-gray-400"
                              }`}
                              title="Change tier"
                            >
                              {t.tier ? t.tier.charAt(0).toUpperCase() + t.tier.slice(1) : "—"}
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60 ml-1" />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                isArchived
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              }`}>
                                {isArchived ? "Suspended" : "Active"}
                              </span>
                              {isArchived && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  Suspended
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--dash-text-secondary)]">{t.userCount}</td>
                          <td className="px-4 py-3 text-[var(--dash-text-secondary)]">{t.documentCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-[var(--dash-text-secondary)]">{t.creditsUsed} / {t.creditsTotal}</span>
                              {t.creditsTotal > 0 && (
                                <div className="w-16 h-1 mt-1 rounded-full bg-[var(--dash-border-subtle)] overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(100, Math.round((t.creditsUsed / t.creditsTotal) * 100))}%`,
                                      background: t.creditsUsed / t.creditsTotal > 0.8 ? "#ef4444" : t.creditsUsed / t.creditsTotal > 0.5 ? "#f59e0b" : "#10b981",
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--dash-text-muted)]">{formatDate(t.lastActive)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {/* Suspend / Unsuspend */}
                              <button
                                onClick={() => setConfirmSuspend(t)}
                                disabled={!!actionLoading}
                                className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${
                                  isArchived
                                    ? "hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-emerald-500"
                                    : "hover:bg-[var(--surface-ground)] text-[var(--dash-text-muted)] hover:text-yellow-500"
                                }`}
                                title={isArchived ? "Reactivate workspace (restore access)" : "Archive workspace (suspend access)"}
                              >
                                {actionLoading === `suspend-${t.id}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isArchived ? (
                                  <PlayCircle className="w-4 h-4" />
                                ) : (
                                  <PauseCircle className="w-4 h-4" />
                                )}
                              </button>
                              {/* Enter Workspace */}
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
                                Enter
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
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

      {/* ==================== ARCHIVE CONFIRM MODAL ==================== */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-md bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <h2 className="text-lg font-semibold text-orange-500 flex items-center gap-2">
                <ArchiveX className="w-5 h-5" />
                Archive User
              </h2>
              <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[var(--dash-text-secondary)]">
                Archive <strong>{confirmDelete.email}</strong>?
              </p>
              <p className="text-xs text-[var(--dash-text-muted)] bg-[var(--surface-ground)] rounded-lg px-3 py-2">
                This immediately revokes this user's access. This user and their data are preserved and you can re-instate them at any time from the Users tab.
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
                  className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading === confirmDelete.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArchiveX className="w-4 h-4" />}
                  Archive User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUSPEND CONFIRM MODAL ==================== */}
      {confirmSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmSuspend(null)} />
          <div className="relative w-full max-w-md bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${confirmSuspend.status === "archived" ? "text-emerald-500" : "text-yellow-500"}`}>
                {confirmSuspend.status === "archived" ? (
                  <PlayCircle className="w-5 h-5" />
                ) : (
                  <PauseCircle className="w-5 h-5" />
                )}
                {confirmSuspend.status === "archived" ? "Reactivate Workspace" : "Archive Workspace"}
              </h2>
              <button onClick={() => setConfirmSuspend(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {confirmSuspend.status === "archived" ? (
                <p className="text-sm text-[var(--dash-text-secondary)]">
                  Reactivate <strong>{confirmSuspend.name}</strong>? Users will regain full access to their workspace.
                </p>
              ) : (
                <p className="text-sm text-[var(--dash-text-secondary)]">
                  Archive <strong>{confirmSuspend.name}</strong>? All users in this workspace will lose access to the platform until they have been reactivated.
                </p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmSuspend(null)}
                  className="px-4 py-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSuspendToggle(confirmSuspend)}
                  disabled={actionLoading === `suspend-${confirmSuspend.id}`}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    confirmSuspend.status === "archived"
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "bg-yellow-500 hover:bg-yellow-600 text-white"
                  }`}
                >
                  {actionLoading === `suspend-${confirmSuspend.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>
                      {confirmSuspend.status === "archived" ? (
                        <PlayCircle className="w-4 h-4" />
                      ) : (
                        <PauseCircle className="w-4 h-4" />
                      )}
                      {confirmSuspend.status === "archived" ? "Reactivate" : "Archive"}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CHANGE TIER MODAL ==================== */}
      {tierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTierModal(null)} />
          <div className="relative w-full max-w-md bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-[var(--brand)]" />
                Change Tier
              </h2>
              <button onClick={() => setTierModal(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <p className="text-sm text-[var(--dash-text-secondary)]">
                Changing tier for <strong>{tierModal.tenant.name}</strong>. Credits allocation will be updated automatically unless you specify a custom amount.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wide">Select Tier</p>
                <div className="grid grid-cols-2 gap-2">
                  {TIERS.map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setTierModal({ ...tierModal, selectedTier: tier })}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                        tierModal.selectedTier === tier
                          ? tier === "enterprise"
                            ? "border-purple-500 bg-purple-500/10 text-purple-400"
                            : tier === "pro"
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : tier === "base"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                            : "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                          : "border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-tertiary)]"
                      }`}
                    >
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--dash-text-tertiary)] uppercase tracking-wide">Custom Credits (optional)</p>
                <input
                  type="number"
                  min="1"
                  placeholder="Leave blank to use tier default..."
                  value={tierModal.customCredits}
                  onChange={(e) => setTierModal({ ...tierModal, customCredits: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setTierModal(null)}
                  className="px-4 py-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeTier}
                  disabled={actionLoading === `tier-${tierModal.tenant.id}` || tierModal.selectedTier === tierModal.tenant.tier}
                  className="flex items-center gap-2 px-5 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {actionLoading === `tier-${tierModal.tenant.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4" />
                  )}
                  Apply Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
