"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Webhook,
  Plus,
  Edit3,
  Trash2,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  Play,
  Pause
} from "lucide-react";

const webhooks = [
  {
    id: "1",
    name: "Slack Notifications",
    url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
    events: ["document.published", "document.updated"],
    status: "active",
    lastTriggered: "2026-01-11T14:30:00Z",
    successRate: 98.5,
    totalCalls: 245,
  },
  {
    id: "2",
    name: "Analytics Webhook",
    url: "https://api.analytics.com/webhook/tynebase",
    events: ["document.viewed", "search.performed"],
    status: "active",
    lastTriggered: "2026-01-11T14:25:00Z",
    successRate: 100,
    totalCalls: 1234,
  },
  {
    id: "3",
    name: "CRM Integration",
    url: "https://crm.example.com/api/webhooks/tynebase",
    events: ["user.invited", "user.role_changed"],
    status: "paused",
    lastTriggered: "2026-01-10T09:00:00Z",
    successRate: 95.2,
    totalCalls: 89,
  },
];

const availableEvents = [
  {
    category: "Documents", events: [
      { id: "document.created", label: "Document Created" },
      { id: "document.updated", label: "Document Updated" },
      { id: "document.published", label: "Document Published" },
      { id: "document.deleted", label: "Document Deleted" },
      { id: "document.viewed", label: "Document Viewed" },
    ]
  },
  {
    category: "Users", events: [
      { id: "user.invited", label: "User Invited" },
      { id: "user.joined", label: "User Joined" },
      { id: "user.role_changed", label: "Role Changed" },
      { id: "user.removed", label: "User Removed" },
    ]
  },
  {
    category: "Search", events: [
      { id: "search.performed", label: "Search Performed" },
      { id: "search.no_results", label: "No Results Found" },
    ]
  },
];

const recentDeliveries = [
  { id: 1, webhook: "Slack Notifications", event: "document.published", status: "success", timestamp: "2026-01-11T14:30:00Z", responseTime: 234 },
  { id: 2, webhook: "Analytics Webhook", event: "document.viewed", status: "success", timestamp: "2026-01-11T14:25:00Z", responseTime: 156 },
  { id: 3, webhook: "Slack Notifications", event: "document.updated", status: "success", timestamp: "2026-01-11T14:20:00Z", responseTime: 312 },
  { id: 4, webhook: "CRM Integration", event: "user.invited", status: "failed", timestamp: "2026-01-10T09:00:00Z", responseTime: 5000 },
  { id: 5, webhook: "Analytics Webhook", event: "search.performed", status: "success", timestamp: "2026-01-11T14:15:00Z", responseTime: 89 },
];

export default function WebhooksPage() {
  const [, setShowCreateModal] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const maskUrl = (url: string, show: boolean) => {
    if (show) return url;
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}/****`;
  };

  return (
    <div className="w-full min-h-full flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Webhooks</h1>
          <p className="text-[var(--text-tertiary)] mt-1">
            Send real-time notifications to external services
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Webhook
        </Button>
      </div>

      {/* Webhooks List */}
      <div className="space-y-4">
        {webhooks.map((webhook) => (
          <Card key={webhook.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${webhook.status === "active"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-amber-500/10 text-amber-500"
                    }`}>
                    <Webhook className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--text-primary)]">{webhook.name}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${webhook.status === "active"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-amber-500/10 text-amber-500"
                        }`}>
                        {webhook.status === "active" ? "Active" : "Paused"}
                      </span>
                    </div>

                    {/* URL */}
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-sm text-[var(--text-tertiary)] bg-[var(--surface-ground)] px-2 py-1 rounded">
                        {maskUrl(webhook.url, showSecrets[webhook.id] || false)}
                      </code>
                      <button
                        onClick={() => setShowSecrets(prev => ({ ...prev, [webhook.id]: !prev[webhook.id] }))}
                        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        {showSecrets[webhook.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Events */}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-[var(--text-tertiary)]">Events:</span>
                      {webhook.events.map((event) => (
                        <span key={event} className="px-2 py-0.5 text-xs bg-[var(--surface-ground)] text-[var(--text-secondary)] rounded">
                          {event}
                        </span>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-tertiary)]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Last triggered {formatTimestamp(webhook.lastTriggered)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        {webhook.successRate}% success
                      </span>
                      <span>{webhook.totalCalls} total calls</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button variant="ghost" className="h-8 px-2">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" className="h-8 px-2">
                    {webhook.status === "active" ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="ghost" className="h-8 px-2">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Deliveries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
          <CardDescription>Last 5 webhook deliveries across all endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentDeliveries.map((delivery) => (
              <div key={delivery.id} className="flex items-center justify-between p-3 bg-[var(--surface-ground)] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${delivery.status === "success"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-500/10 text-red-500"
                    }`}>
                    {delivery.status === "success" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{delivery.webhook}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{delivery.event}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                  <span>{delivery.responseTime}ms</span>
                  <span>{formatTimestamp(delivery.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Events */}
      <Card>
        <CardHeader>
          <CardTitle>Available Events</CardTitle>
          <CardDescription>Events you can subscribe to with webhooks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availableEvents.map((category) => (
              <div key={category.category}>
                <h4 className="font-medium text-[var(--text-primary)] mb-3">{category.category}</h4>
                <div className="space-y-2">
                  {category.events.map((event) => (
                    <div key={event.id} className="flex items-center gap-2 text-sm">
                      <code className="text-xs text-[var(--text-tertiary)] bg-[var(--surface-ground)] px-1.5 py-0.5 rounded">
                        {event.id}
                      </code>
                      <span className="text-[var(--text-secondary)]">{event.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
