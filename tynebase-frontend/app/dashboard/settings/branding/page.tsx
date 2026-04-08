"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Palette, Upload, Eye } from 'lucide-react';

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-sm font-medium">{children}</label>;
}

export default function BrandingSettings() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branding</h1>
          <p className="text-muted-foreground">
            Customize your workspace appearance and branding
          </p>
        </div>
      </div>

      {/* Logo Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Logo & Branding
          </CardTitle>
          <CardDescription>
            Upload your company logo and customize brand colors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="company-logo">Company Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <Button variant="outline" size="sm">
                    Upload Logo
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or SVG. Max 2MB.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="brand-colors">Brand Colors</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded"></div>
                  <Input placeholder="Primary color" defaultValue="#3B82F6" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-600 rounded"></div>
                  <Input placeholder="Secondary color" defaultValue="#6B7280" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Theme Settings</CardTitle>
          <CardDescription>
            Choose your preferred color scheme and appearance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  Light Mode
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Dark Mode
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  System Default
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview
          </CardTitle>
          <CardDescription>
            See how your branding changes will look
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-600 rounded-lg mx-auto"></div>
              <h3 className="font-semibold">Your Company</h3>
              <p className="text-sm text-muted-foreground">Preview of your branded workspace</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Changes */}
      <div className="flex justify-end">
        <Button>Save Branding Changes</Button>
      </div>
    </div>
  );
}
