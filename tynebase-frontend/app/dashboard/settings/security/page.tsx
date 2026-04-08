"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Shield, Key, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { getMe } from '@/lib/api/auth';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

export default function SecuritySettings() {
  const { addToast } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    getMe()
      .then((data) => setEmail(data.user.email))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePasswordReset = async () => {
    if (!email) return;
    setSendingReset(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setResetSent(true);
      addToast({ type: 'success', title: `Password reset email sent to ${email}` });
    } catch {
      addToast({ type: 'error', title: 'Failed to send password reset email' });
    } finally {
      setSendingReset(false);
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
          <h1 className="text-3xl font-bold">Security</h1>
          <p className="text-muted-foreground">
            Manage your password and security settings
          </p>
        </div>
      </div>

      {/* Password Reset */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>
            Change your password by requesting a password reset email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <h4 className="font-medium">Reset Password</h4>
              <p className="text-sm text-muted-foreground">
                A reset link will be sent to {email ?? 'your email'}
              </p>
            </div>
            {resetSent ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Email sent
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handlePasswordReset} disabled={sendingReset}>
                {sendingReset && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Reset Email
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Address
          </CardTitle>
          <CardDescription>
            Your verified account email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <h4 className="font-medium">Primary Email</h4>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
            <Badge variant="default">Verified</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Account Protection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Protection
          </CardTitle>
          <CardDescription>
            Security recommendations for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Email verified</p>
                <p className="text-xs text-green-600">Your account email has been verified</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
