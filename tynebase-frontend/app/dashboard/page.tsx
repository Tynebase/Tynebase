"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useCredits } from "@/contexts/CreditsContext";
import Link from "next/link";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import {
  BookOpen,
  Sparkles,
  Users,
  FileText,
  Plus,
  TrendingUp,
  Eye,
  Clock,
  ArrowRight,
  BarChart3,
  CheckCircle,
  AlertCircle,
  FileQuestion,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboardStats, getRecentDocuments, getRecentActivity, type DashboardStats, type RecentDocument, type RecentActivity } from "@/lib/api/dashboard";
import { capitalize } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const { branding, subdomain, tenant } = useTenant();
  const { creditsRemaining } = useCredits();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isViewer = user?.role === 'viewer' && !user?.is_super_admin;

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [stats, docs, activity] = await Promise.all([
          getDashboardStats(),
          getRecentDocuments(),
          getRecentActivity(),
        ]);
        setStats(stats);
        setRecentDocs(docs.documents);
        setRecentActivity(activity.activities);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const getEventAction = (eventType: string) => {
    switch (eventType) {
      case 'created': return 'created';
      case 'updated': return 'updated';
      case 'published': return 'published';
      case 'ai_generated': return 'generated with AI';
      default: return eventType;
    }
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "published": return "bg-[var(--status-success-bg)] text-[var(--status-success)]";
      case "draft": return "bg-[var(--dash-border-subtle)] text-[var(--dash-text-tertiary)]";
      case "in review": return "bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
      default: return "bg-[var(--dash-border-subtle)] text-[var(--dash-text-tertiary)]";
    }
  };

  // Individual user vs tenant user content
  const isIndividualUser = !subdomain;
  const welcomeTitle = isIndividualUser
    ? `Welcome back, ${user?.full_name || user?.email?.split('@')[0]}!`
    : `Welcome back to ${tenant?.name || 'your workspace'}!`;

  const welcomeSubtitle = isIndividualUser
    ? "Manage your personal knowledge base"
    : "Manage your team's knowledge and documentation";

  const getContentHealthLabel = (percentage: number) => {
    if (percentage >= 80) return "Excellent";
    if (percentage >= 60) return "Very Good";
    if (percentage >= 40) return "Good";
    if (percentage >= 20) return "Poor";
    return "Very Poor";
  };

  const contentHealthPct = 100 - (stats?.storage.percentage || 0);
  const contentHealthLabel = getContentHealthLabel(contentHealthPct);

  // Customize stats based on user type
  const quickStats = isIndividualUser ? [
    { label: "Total documents", value: stats?.documents.total.toString() || "0", change: `${stats?.documents.published || 0} published`, icon: BookOpen, color: "var(--brand)" },
    { label: "AI generations", value: stats?.ai.generations.toString() || "0", change: `${creditsRemaining} credits left`, icon: Sparkles, color: "var(--accent-purple)" },
    { label: "Storage Used", value: stats?.storage.used_mb && stats.storage.used_mb < 1024 ? `${stats.storage.used_mb}MB` : `${stats?.storage.used_gb || 0}GB`, change: stats?.storage.limit_mb && stats.storage.limit_mb < 1024 ? `${stats.storage.limit_mb}MB total` : `${stats?.storage.limit_gb || 5}GB total`, icon: TrendingUp, color: "var(--accent-blue)" },
    { label: "Content health", value: `${contentHealthPct}%`, change: contentHealthLabel, icon: BarChart3, color: "var(--status-success)" },
  ] : [
    { label: "Total documents", value: stats?.documents.total.toString() || "0", change: `${stats?.documents.published || 0} published`, icon: BookOpen, color: "var(--brand)" },
    { label: "Team members", value: stats?.team.members.toString() || "0", change: "Active users", icon: Users, color: "var(--accent-blue)" },
    { label: "AI generations", value: stats?.ai.generations.toString() || "0", change: `${creditsRemaining} credits left`, icon: Sparkles, color: "var(--accent-purple)" },
    { label: "Content health", value: `${contentHealthPct}%`, change: contentHealthLabel, icon: BarChart3, color: "var(--status-success)" },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col gap-8">
      {/* Welcome Header */}
      <DashboardPageHeader
        title={
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">
            {welcomeTitle}
          </h1>
        }
        description={
          <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">{welcomeSubtitle}</p>
        }
        right={
          !isViewer && (
            <Link href="/dashboard/knowledge/new">
              <button className="flex items-center gap-2 h-9 px-5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-medium transition-all">
                <Plus className="w-4 h-4" />
                New Document
              </button>
            </Link>
          )
        }
      />

      <div className="flex-1 min-h-0 flex flex-col gap-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickStats.map((stat) => (
            <Card
              key={stat.label}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-[var(--dash-text-tertiary)]">{stat.label}</p>
                    <p className="text-2xl font-bold text-[var(--dash-text-primary)] mt-1">{stat.value}</p>
                    <p className="text-xs text-[var(--dash-text-muted)] mt-1">{stat.change}</p>
                  </div>
                  <div
                    className="p-2.5 rounded-lg"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {!isViewer && (
            <Link href="/dashboard/ai-assistant" className="group">
              <Card className="hover:shadow-md hover:border-[var(--brand)] transition-all h-full">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3.5 rounded-lg bg-[var(--brand-primary-muted)]">
                    <Sparkles className="w-6 h-6 text-[var(--brand)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--dash-text-primary)] group-hover:text-[var(--brand)]">
                      AI Assistant
                    </h3>
                    <p className="text-sm text-[var(--dash-text-tertiary)]">Generate content with AI</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[var(--dash-text-muted)] group-hover:text-[var(--brand)] group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </Link>
          )}

          {!isViewer && (
            <Link href="/dashboard/templates" className="group">
              <Card className="hover:shadow-md hover:border-[var(--accent-purple)] transition-all h-full">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3.5 rounded-lg bg-purple-50">
                    <FileText className="w-6 h-6 text-[var(--accent-purple)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--dash-text-primary)] group-hover:text-[var(--accent-purple)]">
                      Templates
                    </h3>
                    <p className="text-sm text-[var(--dash-text-tertiary)]">Browse template library</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[var(--dash-text-muted)] group-hover:text-[var(--accent-purple)] group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </Link>
          )}

          <Link href="/dashboard/audit" className={`group ${isViewer ? 'md:col-span-3' : ''}`}>
            <Card className="hover:shadow-md hover:border-[var(--accent-blue)] transition-all h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3.5 rounded-lg bg-blue-50">
                  <BarChart3 className="w-6 h-6 text-[var(--accent-blue)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--dash-text-primary)] group-hover:text-[var(--accent-blue)]">
                    Content audit
                  </h3>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Analyse content health</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[var(--dash-text-muted)] group-hover:text-[var(--accent-blue)] group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Documents */}
          <Card className="lg:col-span-2 flex flex-col min-h-0">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[var(--dash-border-subtle)] space-y-0">
              <div>
                <CardTitle className="text-base">Recent Documents</CardTitle>
                <CardDescription>Your latest articles and pages</CardDescription>
              </div>
              <Link href="/dashboard/knowledge" className="text-sm text-[var(--brand)] hover:underline">
                View all
              </Link>
            </CardHeader>
            <div className="flex-1 min-h-0 overflow-auto divide-y divide-[var(--dash-border-subtle)] dashboard-scroll">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
                </div>
              ) : recentDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-[var(--dash-text-muted)] mb-3" />
                  <p className="text-[var(--dash-text-secondary)]">No documents yet</p>
                  <p className="text-sm text-[var(--dash-text-muted)] mt-1">Create your first document to get started</p>
                </div>
              ) : recentDocs.map((doc: RecentDocument) => (
                <div
                  key={doc.id}
                  onClick={() => router.push(`/dashboard/knowledge/${doc.id}`)}
                  className="block hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                >
                  {/* Desktop View */}
                  <div className="hidden md:flex items-center gap-4 px-6 py-5">
                    <div className="p-2.5 rounded-lg bg-[var(--surface-ground)]">
                      <FileText className="w-5 h-5 text-[var(--dash-text-tertiary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--dash-text-primary)] truncate">{doc.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStateColor(doc.status)}`}>
                          {capitalize(doc.status)}
                        </span>
                        <span className="text-xs text-[var(--dash-text-muted)] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(doc.updated_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-[var(--dash-text-muted)]">
                      <Clock className="w-4 h-4" />
                      {formatTimeAgo(doc.updated_at)}
                    </div>
                  </div>

                  {/* Mobile View - Contact Card Style */}
                  <div className="flex md:hidden items-start gap-3 p-4">
                    <div className="p-2 rounded-lg bg-[var(--surface-ground)] mt-1">
                      <FileText className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--dash-text-primary)] text-sm mb-1 line-clamp-2">{doc.title}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getStateColor(doc.status)}`}>
                          {capitalize(doc.status)}
                        </span>
                        <span className="text-[10px] text-[var(--dash-text-muted)] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(doc.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity Feed */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="pb-4 border-b border-[var(--dash-border-subtle)]">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Team updates</CardDescription>
            </CardHeader>
            <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4 dashboard-scroll">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="w-10 h-10 text-[var(--dash-text-muted)] mb-2" />
                  <p className="text-sm text-[var(--dash-text-secondary)]">No recent activity</p>
                </div>
              ) : recentActivity.map((activity: RecentActivity) => (
                <div 
                  key={activity.id} 
                  onClick={() => router.push(`/dashboard/knowledge/${activity.document_id}`)}
                  className="flex gap-3 cursor-pointer hover:bg-[var(--surface-hover)] -mx-6 px-6 py-3 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-primary-muted)] flex items-center justify-center text-[var(--brand)] font-semibold text-xs flex-shrink-0">
                    {(activity.users.full_name || activity.users.email).split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--dash-text-secondary)]">
                      <span className="font-medium text-[var(--dash-text-primary)]">{activity.users.full_name || activity.users.email}</span>
                      {" "}{getEventAction(activity.event_type)}{" "}
                      <span className="font-medium text-[var(--dash-text-primary)]">{activity.documents.title}</span>
                    </p>
                    <p className="text-xs text-[var(--dash-text-muted)] mt-0.5">{formatTimeAgo(activity.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[var(--dash-border-subtle)]">
              <Link href="/dashboard/community" className="text-sm text-[var(--brand)] hover:underline">
                View all activity
              </Link>
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
}
