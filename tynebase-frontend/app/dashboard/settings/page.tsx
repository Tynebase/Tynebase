"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  CreditCard, 
  User, 
  Bell, 
  Shield, 
  Globe,
  ArrowRight,
  Settings,
  ShieldCheck,
  Palette,
  History
} from 'lucide-react';

export default function SettingsPage() {
  const settingsSections = [
    {
      title: 'Account',
      description: 'Manage your profile and account settings',
      icon: User,
      href: '/dashboard/settings/account',
      color: 'text-blue-600'
    },
    {
      title: 'Billing & Plans',
      description: 'Manage your subscription and billing information',
      icon: CreditCard,
      href: '/dashboard/settings/billing',
      color: 'text-green-600'
    },
    {
      title: 'Notifications',
      description: 'Configure notification preferences',
      icon: Bell,
      href: '/dashboard/settings/notifications',
      color: 'text-purple-600'
    },
    {
      title: 'Security',
      description: 'Manage passwords, 2FA, and security settings',
      icon: Shield,
      href: '/dashboard/settings/security',
      color: 'text-red-600'
    },
    {
      title: 'Preferences',
      description: 'Customize your experience and interface',
      icon: Settings,
      href: '/dashboard/preferences',
      color: 'text-gray-600'
    },
    {
      title: 'Integrations',
      description: 'Manage third-party integrations and connections',
      icon: Globe,
      href: '/dashboard/settings/integrations',
      color: 'text-indigo-600'
    },
    {
      title: 'Branding',
      description: 'Customise your workspace appearance and logo',
      icon: Palette,
      href: '/dashboard/settings/branding',
      color: 'text-pink-600'
    },
    {
      title: 'Audit Logs',
      description: 'View administrative activity and security logs',
      icon: History,
      href: '/dashboard/settings/audit-logs',
      color: 'text-amber-600'
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => {
          const IconComponent = section.icon;
          return (
            <Card key={section.title} className="hover:shadow-md transition-shadow cursor-pointer group">
              <Link href={section.href}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${section.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="ml-11">
                    {section.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between ml-11">
                    <span className="text-sm text-muted-foreground">Configure</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common settings and account management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/settings/billing">
                <CreditCard className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/settings/account">
                <User className="h-4 w-4 mr-2" />
                Edit Profile
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/settings/security">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/dashboard/settings/notifications">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
