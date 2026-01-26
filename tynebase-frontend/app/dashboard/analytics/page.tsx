"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Eye,
  Clock,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Download
} from "lucide-react";

const timeRanges = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "12m", label: "Last 12 months" },
];

const stats = [
  {
    label: "Total Views",
    value: "24,521",
    change: "+12.5%",
    trend: "up",
    icon: Eye,
    color: "blue"
  },
  {
    label: "Unique Visitors",
    value: "3,847",
    change: "+8.2%",
    trend: "up",
    icon: Users,
    color: "purple"
  },
  {
    label: "Documents",
    value: "156",
    change: "+23",
    trend: "up",
    icon: FileText,
    color: "pink"
  },
  {
    label: "Avg. Time on Page",
    value: "4m 32s",
    change: "-0.8%",
    trend: "down",
    icon: Clock,
    color: "cyan"
  },
];

const topDocuments = [
  { title: "Getting Started Guide", views: 3421, change: 12.5 },
  { title: "API Authentication", views: 2893, change: 8.3 },
  { title: "Team Permissions", views: 2145, change: -2.1 },
  { title: "Integrations Overview", views: 1876, change: 15.7 },
  { title: "Troubleshooting FAQ", views: 1654, change: 5.2 },
];

const searchQueries = [
  { query: "authentication", count: 234, found: true },
  { query: "api key", count: 189, found: true },
  { query: "webhook setup", count: 156, found: false },
  { query: "permissions", count: 143, found: true },
  { query: "sso integration", count: 128, found: false },
];

const activityData = [
  { day: "Mon", views: 1234, edits: 45 },
  { day: "Tue", views: 1456, edits: 52 },
  { day: "Wed", views: 1678, edits: 38 },
  { day: "Thu", views: 1890, edits: 67 },
  { day: "Fri", views: 1567, edits: 43 },
  { day: "Sat", views: 890, edits: 12 },
  { day: "Sun", views: 756, edits: 8 },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d");

  const maxViews = Math.max(...activityData.map(d => d.views));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={<h1 className="text-3xl font-bold text-[var(--text-primary)]">Analytics</h1>}
        description={
          <p className="text-[var(--text-tertiary)] mt-1">
            Track engagement and usage across your knowledge base
          </p>
        }
        right={
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg p-1">
              {timeRanges.map((range) => (
                <button
                  key={range.id}
                  onClick={() => setTimeRange(range.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${timeRange === range.id
                      ? "bg-[var(--brand-primary)] text-white"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 text-[var(--brand)]`} />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${stat.trend === "up" ? "text-green-500" : "text-red-500"
                  }`}>
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {stat.change}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                <p className="text-sm text-[var(--text-tertiary)]">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
            <CardDescription>Views and edits over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-2">
              {activityData.map((day) => (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col gap-1">
                    <div
                      className="w-full bg-[var(--brand-primary)] rounded-t-sm transition-all hover:opacity-80"
                      style={{ height: `${(day.views / maxViews) * 180}px` }}
                      title={`${day.views} views`}
                    />
                    <div
                      className="w-full bg-[var(--accent-purple)] rounded-t-sm transition-all hover:opacity-80"
                      style={{ height: `${(day.edits / maxViews) * 180}px` }}
                      title={`${day.edits} edits`}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">{day.day}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[var(--brand-primary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Views</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[var(--accent-purple)]" />
                <span className="text-sm text-[var(--text-secondary)]">Edits</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Top Documents</CardTitle>
            <CardDescription>Most viewed articles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topDocuments.map((doc, i) => (
                <div key={doc.title} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--surface-ground)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)]">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {doc.title}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {doc.views.toLocaleString()} views
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${doc.change >= 0 ? "text-green-500" : "text-red-500"
                    }`}>
                    {doc.change >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(doc.change)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Analytics
            </CardTitle>
            <CardDescription>What users are searching for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {searchQueries.map((item) => (
                <div key={item.query} className="flex items-center justify-between p-3 bg-[var(--surface-ground)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Search className="w-4 h-4 text-[var(--text-tertiary)]" />
                    <span className="font-medium text-[var(--text-primary)]">"{item.query}"</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[var(--text-tertiary)]">{item.count} searches</span>
                    {item.found ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                        Found
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full">
                        No results
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-4">
              Consider creating content for queries with "No results" to improve findability.
            </p>
          </CardContent>
        </Card>

        {/* Team Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Activity
            </CardTitle>
            <CardDescription>Recent contributor activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Sarah Chen", avatar: "SC", action: "Updated", doc: "API Authentication", time: "2 hours ago", color: "blue" },
                { name: "John Smith", avatar: "JS", action: "Created", doc: "Webhook Guide", time: "5 hours ago", color: "purple" },
                { name: "Emily Davis", avatar: "ED", action: "Published", doc: "Team Permissions", time: "1 day ago", color: "pink" },
                { name: "Mike Johnson", avatar: "MJ", action: "Reviewed", doc: "Security Policy", time: "2 days ago", color: "cyan" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full bg-[var(--brand)]/10 flex items-center justify-center text-xs font-medium text-[var(--brand)]`}>
                    {activity.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">{activity.name}</span>
                      {" "}{activity.action.toLowerCase()}{" "}
                      <span className="font-medium">{activity.doc}</span>
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
