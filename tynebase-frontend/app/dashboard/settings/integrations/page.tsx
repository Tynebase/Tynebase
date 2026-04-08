"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  Globe, 
  Github, 
  Slack, 
  Zap, 
  Key, 
  Plug,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

export default function IntegrationsSettings() {
  const [connectedIntegrations, setConnectedIntegrations] = useState([
    { id: 'slack', name: 'Slack', status: 'connected', icon: Slack },
    { id: 'github', name: 'GitHub', status: 'disconnected', icon: Github },
  ]);

  const availableIntegrations = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notifications and share content in Slack channels',
      icon: Slack,
      category: 'Communication',
      features: ['Real-time notifications', 'Document sharing', 'Channel management']
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Sync documents with GitHub repositories',
      icon: Github,
      category: 'Development',
      features: ['Repository sync', 'Issue tracking', 'Pull request integration']
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect with 3000+ apps via Zapier automation',
      icon: Zap,
      category: 'Automation',
      features: ['Custom workflows', 'Multi-app connections', 'Scheduled tasks']
    },
    {
      id: 'webhook',
      name: 'Webhooks',
      description: 'Receive real-time data via custom webhooks',
      icon: Globe,
      category: 'Developer Tools',
      features: ['Custom endpoints', 'Event triggers', 'Data formatting']
    }
  ];

  const isConnected = (integrationId: string) => {
    return connectedIntegrations.some(int => int.id === integrationId && int.status === 'connected');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Connect TyneBase with your favorite tools and services
          </p>
        </div>
        <Button variant="outline">
          <Key className="h-4 w-4 mr-2" />
          API Keys
        </Button>
      </div>

      {/* Connected Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Connected Integrations
          </CardTitle>
          <CardDescription>
            Manage your active integrations and connections
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectedIntegrations.filter(int => int.status === 'connected').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No integrations connected yet</p>
              <p className="text-sm">Connect your first integration below</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connectedIntegrations
                .filter(int => int.status === 'connected')
                .map((integration) => {
                  const IconComponent = integration.icon;
                  return (
                    <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-medium">{integration.name}</h4>
                          <p className="text-sm text-muted-foreground">Connected and active</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Connected
                        </Badge>
                        <Button variant="outline" size="sm">Configure</Button>
                        <Button variant="destructive" size="sm">Disconnect</Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Integrations */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Available Integrations</h2>
          <p className="text-muted-foreground">Connect new tools and services to enhance your workflow</p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {availableIntegrations.map((integration) => {
            const IconComponent = integration.icon;
            const connected = isConnected(integration.id);
            
            return (
              <Card key={integration.id} className={`hover:shadow-md transition-shadow ${connected ? 'border-green-200 bg-green-50/50' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">{integration.category}</Badge>
                      </div>
                    </div>
                    {connected && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{integration.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Features:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {integration.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center justify-between">
                      {connected ? (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Configure</Button>
                          <Button variant="destructive" size="sm">Disconnect</Button>
                        </div>
                      ) : (
                        <Button className="w-full">
                          Connect {integration.name}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* API Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
          </CardTitle>
          <CardDescription>
            Generate API keys for programmatic access to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys generated yet</p>
              <p className="text-sm">Create your first API key to get started</p>
            </div>
            <Button>Create API Key</Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Webhooks
          </CardTitle>
          <CardDescription>
            Configure webhooks to receive real-time events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhooks configured yet</p>
              <p className="text-sm">Set up webhooks to receive events in your applications</p>
            </div>
            <Button>Add Webhook</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
