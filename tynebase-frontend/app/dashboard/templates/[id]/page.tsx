"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, FileText, User, Globe, Lock, Loader2, AlertCircle, CheckCircle, Tag, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getTemplate, useTemplate, updateTemplate, deleteTemplate, type Template } from "@/lib/api/templates";
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

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editVisibility, setEditVisibility] = useState<"internal" | "public">("internal");
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  function enterEditMode() {
    if (!template) return;
    setEditTitle(template.title);
    setEditDescription(template.description || "");
    setEditContent(template.content);
    setEditVisibility(template.visibility);
    setIsEditing(true);
    setError(null);
  }

  function cancelEdit() {
    setIsEditing(false);
    setError(null);
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) {
      setError("Template title is required");
      return;
    }
    if (!editContent.trim()) {
      setError("Template content is required");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await updateTemplate(templateId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        content: editContent.trim(),
        visibility: editVisibility,
      });

      setTemplate(response.template);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to update template:', err);
      setError(err.message || 'Failed to update template');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    try {
      setIsDeleting(true);
      setError(null);

      await deleteTemplate(templateId);
      router.push('/dashboard/templates');
    } catch (err: any) {
      console.error('Failed to delete template:', err);
      setError(err.message || 'Failed to delete template');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

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

  // Check if this is a tenant-owned template (editable)
  const isTenantTemplate = template?.tenant_id !== null;

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
        <div className="flex items-center gap-2">
          {isTenantTemplate && !isEditing && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={enterEditMode}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-2 text-[var(--status-error)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          )}
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
                disabled={isSaving}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="gap-2 min-w-[140px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
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
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)]/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--dash-text-primary)]">Delete this template?</h3>
            <p className="text-sm text-[var(--dash-text-secondary)] mt-1">This action cannot be undone. The template will be permanently deleted.</p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-[var(--status-error)] hover:opacity-90 text-white gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)]/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--dash-text-primary)]">Error</h3>
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

      {/* Template Info Bar / Edit Form */}
      {template && !isEditing && (
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

      {/* Edit Form */}
      {template && isEditing && (
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 flex flex-col gap-4">
          <div>
            <label htmlFor="editTitle" className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Template Title*
            </label>
            <input
              id="editTitle"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Template title"
              className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>
          <div>
            <label htmlFor="editDescription" className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Description
            </label>
            <textarea
              id="editDescription"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Brief description of what this template is for..."
              rows={2}
              className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
              Visibility
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditVisibility("internal")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  editVisibility === "internal"
                    ? "border-[var(--brand)] bg-[var(--brand)]/5"
                    : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                }`}
              >
                <Lock className={`w-4 h-4 ${editVisibility === "internal" ? "text-[var(--brand)]" : "text-[var(--dash-text-tertiary)]"}`} />
                <span className="text-sm font-medium text-[var(--dash-text-primary)]">Internal</span>
              </button>
              <button
                type="button"
                onClick={() => setEditVisibility("public")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  editVisibility === "public"
                    ? "border-[var(--brand)] bg-[var(--brand)]/5"
                    : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                }`}
              >
                <Globe className={`w-4 h-4 ${editVisibility === "public" ? "text-[var(--brand)]" : "text-[var(--dash-text-tertiary)]"}`} />
                <span className="text-sm font-medium text-[var(--dash-text-primary)]">Public</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Content Preview / Edit */}
      {template && !isEditing && (
        <div className="flex-1 min-h-0 overflow-auto">
          <MarkdownReader content={template.content} title={template.title} />
        </div>
      )}

      {template && isEditing && (
        <div className="flex-1 flex flex-col min-h-0">
          <label htmlFor="editContent" className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
            Template Content*
          </label>
          <textarea
            id="editContent"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Enter the template content in markdown format..."
            className="flex-1 min-h-[300px] px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 resize-none font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}
