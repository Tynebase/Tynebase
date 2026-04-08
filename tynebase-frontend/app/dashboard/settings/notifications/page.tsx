"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Bell, Mail, Loader2 } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { getMe, updateProfile } from '@/lib/api/auth';
import { useToast } from '@/components/ui/Toast';

interface NotifPrefs {
  email_notifications: boolean;
  push_notifications: boolean;
  weekly_digest: boolean;
  marketing_emails: boolean;
}

export default function NotificationSettings() {
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>({
    email_notifications: true,
    push_notifications: true,
    weekly_digest: false,
    marketing_emails: false,
  });

  useEffect(() => {
    getMe()
      .then((data) => {
        const p = data.user.notification_preferences;
        if (p) {
          setPrefs({
            email_notifications: p.email_notifications ?? true,
            push_notifications: p.push_notifications ?? true,
            weekly_digest: p.weekly_digest ?? false,
            marketing_emails: p.marketing_emails ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ notification_preferences: prefs });
      addToast({ type: 'success', title: 'Notification preferences saved' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground">
            Configure how and when you receive notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{unreadCount} unread</Badge>
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Delivery Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  In-App Notifications
                </h4>
                <p className="text-sm text-muted-foreground">Show notifications in the app</p>
              </div>
              <Switch
                checked={prefs.push_notifications}
                onCheckedChange={(v) => setPrefs(p => ({ ...p, push_notifications: v }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Notifications
                </h4>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
              <Switch
                checked={prefs.email_notifications}
                onCheckedChange={(v) => setPrefs(p => ({ ...p, email_notifications: v }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Weekly Digest</h4>
                <p className="text-sm text-muted-foreground">Weekly summary of activity</p>
              </div>
              <Switch
                checked={prefs.weekly_digest}
                onCheckedChange={(v) => setPrefs(p => ({ ...p, weekly_digest: v }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Marketing Emails</h4>
                <p className="text-sm text-muted-foreground">Product updates and announcements</p>
              </div>
              <Switch
                checked={prefs.marketing_emails}
                onCheckedChange={(v) => setPrefs(p => ({ ...p, marketing_emails: v }))}
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>
            Your latest notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border ${n.read ? 'opacity-60' : 'bg-[var(--surface-hover)]'}`}>
                  <Bell className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--brand)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.description && <p className="text-xs text-muted-foreground truncate">{n.description}</p>}
                  </div>
                  {!n.read && <Badge variant="default" className="ml-auto flex-shrink-0">New</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
