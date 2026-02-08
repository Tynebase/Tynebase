"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, FileText, Calendar, User, Globe, Lock, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useTemplate } from "@/lib/api/templates";

export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleUseTemplate() {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await useTemplate(templateId);
      const documentId = response.document.id;

      setSuccess(true);
      
      setTimeout(() => {
        router.push(`/dashboard/knowledge/${documentId}`);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to use template:', err);
      setError(err.message || 'Failed to create document from template');
      setLoading(false);
    }
  }

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/templates')}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">Failed to use template</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success State */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-green-900">Document created successfully</h3>
            <p className="text-sm text-green-700 mt-1">Redirecting to editor...</p>
          </div>
        </div>
      )}

      {/* Template Preview Card */}
      <Card className="flex-1">
        <CardContent className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[var(--brand)]" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--dash-text-primary)] mb-3">
                Template Preview
              </h1>
              <p className="text-[var(--dash-text-tertiary)] text-lg">
                Click Use Template to create a new document from this template
              </p>
            </div>

            <div className="flex justify-center mb-8">
              <Button
                size="lg"
                onClick={handleUseTemplate}
                disabled={loading || success}
                className="gap-2 min-w-[200px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Document...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Document Created
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Use Template
                  </>
                )}
              </Button>
            </div>

            <div className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-6">
              <div className="prose prose-sm max-w-none">
                <p className="text-[var(--dash-text-secondary)]">
                  A new document will be created as a draft. The template content will be copied to the new document.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <FileText className="w-4 h-4 text-[var(--dash-text-muted)]" />
                    <span className="text-[var(--dash-text-secondary)]">
                      New document will be created as a draft
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <User className="w-4 h-4 text-[var(--dash-text-muted)]" />
                    <span className="text-[var(--dash-text-secondary)]">
                      You'll be set as the document author
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-[var(--dash-text-muted)]" />
                    <span className="text-[var(--dash-text-secondary)]">
                      Template content will be copied to the new document
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
