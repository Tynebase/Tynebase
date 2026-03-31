"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle, ArrowRight, Zap, CreditCard, History } from 'lucide-react';

export default function BillingPage() {
  const [isUpdating, setIsUpdating] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Plans</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing information
          </p>
        </div>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Your current subscription and usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-semibold">Free Tier</h3>
                <Badge variant="secondary">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Perfect for getting started with basic features
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Up to 3 documents</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Basic AI assistance</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Community support</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">$0<span className="text-sm font-normal">/month</span></div>
              <Button className="mt-2" variant="outline">
                Upgrade Plan
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Pro Plan */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Pro Plan
              </CardTitle>
              <CardDescription>
                For professionals and growing teams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-4">
                $19<span className="text-sm font-normal">/month</span>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Unlimited documents</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Advanced AI features</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Priority support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Team collaboration</span>
                </div>
              </div>
              <Button className="w-full">Upgrade to Pro</Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Enterprise
              </CardTitle>
              <CardDescription>
                Custom solutions for large organizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-4">
                Custom
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Everything in Pro</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Custom integrations</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Dedicated support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>SLA guarantee</span>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No billing history available</p>
            <p className="text-sm">Your payment history will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
