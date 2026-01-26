"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { Button } from "@/components/ui/Button";
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  MoreHorizontal,
  Globe,
  Lock,
  Clock,
  Folder,
  Tag,
  Users,
  ChevronDown
} from "lucide-react";
import Link from "next/link";
import { createDocument, publishDocument } from "@/lib/api/documents";

export default function NewDocumentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [folder] = useState("Uncategorized");
  const [visibility, setVisibility] = useState<"public" | "private" | "team">("team");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (data: { title: string; content: string }) => {
    try {
      setIsSaving(true);
      setError(null);
      
      if (documentId) {
        // Document already exists, just update local state
        setTitle(data.title);
        setContent(data.content);
      } else {
        // Create new document as draft
        const response = await createDocument({
          title: data.title || "Untitled Document",
          content: data.content || "",
          is_public: visibility === "public",
        });
        
        setDocumentId(response.data.document.id);
        setTitle(data.title);
        setContent(data.content);
      }
    } catch (err) {
      console.error('Failed to save document:', err);
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      let docId = documentId;
      
      // Create document first if it doesn't exist
      if (!docId) {
        const response = await createDocument({
          title: title || "Untitled Document",
          content: content || "",
          is_public: visibility === "public",
        });
        docId = response.data.document.id;
        setDocumentId(docId);
      }
      
      // Publish the document
      await publishDocument(docId);
      setStatus("published");
      
      // Redirect to the document view page
      router.push(`/dashboard/knowledge/${docId}`);
    } catch (err) {
      console.error('Failed to publish document:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish document');
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      let docId = documentId;
      
      // Create document if it doesn't exist
      if (!docId) {
        const response = await createDocument({
          title: title || "Untitled Document",
          content: content || "",
          is_public: visibility === "public",
        });
        docId = response.data.document.id;
      }
      
      // Redirect to the document edit page
      router.push(`/dashboard/knowledge/${docId}`);
    } catch (err) {
      console.error('Failed to save draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to save draft');
      setIsSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col -m-6">
      {/* Error Banner */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/knowledge">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <span>Knowledge Base</span>
            <span>/</span>
            <span className="text-[var(--text-primary)]">New Document</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
            status === "draft" 
              ? "bg-amber-500/10 text-amber-600" 
              : "bg-green-500/10 text-green-600"
          }`}>
            {status === "draft" ? (
              <>
                <Clock className="w-3.5 h-3.5" />
                Draft
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                Published
              </>
            )}
          </div>

          {/* Preview */}
          <Button variant="ghost" className="gap-2">
            <Eye className="w-4 h-4" />
            Preview
          </Button>

          {/* Save Draft */}
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>

          {/* Publish */}
          <Button variant="primary" onClick={handlePublish} disabled={isSaving}>
            <Globe className="w-4 h-4 mr-2" />
            Publish
          </Button>

          {/* More Options */}
          <Button variant="ghost" className="px-2" onClick={() => setShowSettings(!showSettings)}>
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 p-6 overflow-hidden">
          <DocumentEditor
            initialTitle={title}
            initialContent={content}
            onSave={handleSave}
            onTitleChange={setTitle}
            onContentChange={setContent}
          />
        </div>

        {/* Settings Sidebar */}
        {showSettings && (
          <div className="w-80 border-l border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-y-auto">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Document Settings</h3>
            </div>

            <div className="p-4 space-y-6">
              {/* Folder */}
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2 mb-2">
                  <Folder className="w-4 h-4" />
                  Folder
                </label>
                <button className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-left">
                  <span className="text-[var(--text-primary)]">{folder}</span>
                  <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                </button>
              </div>

              {/* Visibility */}
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  Visibility
                </label>
                <div className="space-y-2">
                  {[
                    { id: "public", label: "Public", desc: "Anyone can view", icon: Globe },
                    { id: "team", label: "Team Only", desc: "Workspace members", icon: Users },
                    { id: "private", label: "Private", desc: "Only you", icon: Lock },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setVisibility(option.id as typeof visibility)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        visibility === option.id
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                          : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                      }`}
                    >
                      <option.icon className={`w-4 h-4 ${
                        visibility === option.id 
                          ? "text-[var(--brand-primary)]" 
                          : "text-[var(--text-tertiary)]"
                      }`} />
                      <div className="text-left">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{option.label}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </label>
                <input
                  type="text"
                  placeholder="Add tags..."
                  className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* SEO */}
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
                  SEO Description
                </label>
                <textarea
                  placeholder="Brief description for search engines..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
