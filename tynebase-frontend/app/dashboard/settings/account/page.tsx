"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { User, Mail, Crown, Loader2 } from 'lucide-react';
import { getMe, updateProfile } from '@/lib/api/auth';
import { useToast } from '@/components/ui/Toast';
import type { MeResponse } from '@/types/api';

export default function AccountSettings() {
  const { addToast } = useToast();
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    getMe()
      .then((data) => {
        setMeData(data);
        setFullName(data.user.full_name ?? '');
      })
      .catch(() => addToast({ type: 'error', title: 'Failed to load account settings' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ full_name: fullName });
      setMeData(updated);
      addToast({ type: 'success', title: 'Profile updated' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update profile' });
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

  const user = meData?.user;
  const tenant = meData?.tenant;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile and account information
          </p>
        </div>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your personal information and profile details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Profile Changes
          </Button>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Address
          </CardTitle>
          <CardDescription>
            Your account email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <h4 className="font-medium">Primary Email</h4>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Badge variant="default">Verified</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Subscription Status
          </CardTitle>
          <CardDescription>
            Your current plan and subscription details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Current Plan</h4>
                <p className="text-sm text-muted-foreground">
                  {tenant?.tier ? tenant.tier.charAt(0).toUpperCase() + tenant.tier.slice(1) : '—'} Tier
                </p>
              </div>
              <Badge variant="secondary">
                {user?.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Active'}
              </Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Workspace</p>
                <p className="font-medium">{tenant?.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Role</p>
                <p className="font-medium">
                  {user?.is_super_admin ? 'Super Admin' : user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
