"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, FileText, User, Globe, Lock, Loader2, AlertCircle, CheckCircle, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getTemplate, useTemplate, type Template } from "@/lib/api/templates";
import { MarkdownReader } from "@/components/ui/MarkdownReader";

export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  
  const [template, setTemplate] = useState<Template | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadTemplate() {
      try {
        setFetchLoading(true);
        setFetchError(null);
        const response = await getTemplate(templateId);
        setTemplate(response.template);
      } catch (err: any) {
        console.error('Failed to fetch template:', err);
        setFetchError(err.message || 'Failed to load template');
      } finally {
        setFetchLoading(false);
      }
    }
    loadTemplate();
  }, [templateId]);

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

  if (fetchLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" />
          <p className="text-sm text-[var(--dash-text-tertiary)]">Loading template...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-8 h-8 text-[var(--status-error)]" />
          <p className="text-sm text-[var(--dash-text-primary)] font-medium">{fetchError}</p>
          <Button variant="ghost" onClick={() => router.push('/dashboard/templates')}>Back to Templates</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/templates')}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </Button>
        <Button
          size="sm"
          onClick={handleUseTemplate}
          disabled={loading || success}
          className="gap-2 min-w-[180px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : success ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Created!
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Use Template
            </>
          )}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)]/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--dash-text-primary)]">Failed to use template</h3>
            <p className="text-sm text-[var(--dash-text-secondary)] mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success State */}
      {success && (
        <div className="bg-[var(--status-success-bg)] border border-[var(--status-success)]/20 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-[var(--status-success)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--dash-text-primary)]">Document created successfully</h3>
            <p className="text-sm text-[var(--dash-text-secondary)] mt-1">Redirecting to editor...</p>
          </div>
        </div>
      )}

      {/* Template Info Bar */}
      {template && (
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--dash-text-primary)]">{template.title}</h1>
              {template.description && (
                <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">{template.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {template.category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--surface-ground)] text-[var(--dash-text-secondary)]">
                  <Tag className="w-3 h-3" />
                  {template.category}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--surface-ground)] text-[var(--dash-text-secondary)]">
                {template.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {template.visibility === 'public' ? 'Public' : 'Internal'}
              </span>
              {template.users?.full_name && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--surface-ground)] text-[var(--dash-text-secondary)]">
                  <User className="w-3 h-3" />
                  {template.users.full_name}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Content Preview */}
      {template && (
        <div className="flex-1 min-h-0 overflow-auto">
          <MarkdownReader content={template.content} title={template.title} />
        </div>
      )}
    </div>
  );
}
