"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { MarkdownReader } from "@/components/ui/MarkdownReader";
import { VersionHistory } from "@/components/ui/VersionHistory";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Eye,
  MoreHorizontal,
  Globe,
  Lock,
  Clock,
  Folder,
  Tag,
  Users,
  ChevronDown,
  History,
  Trash2,
  Copy,
  ExternalLink,
  Sparkles,
  Send
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/Card";

function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h\d>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// Mock document data
const mockDocuments: Record<string, {
  id: string;
  title: string;
  content: string;
  folder: string;
  status: "Draft" | "Published";
  visibility: "public" | "private" | "team";
  author: string;
  createdAt: string;
  updatedAt: string;
}> = {
  "1": {
    id: "1",
    title: "Getting Started Guide",
    content: `<h2>Welcome to TyneBase</h2>
<p>This guide will help you get started with TyneBase, your AI-powered knowledge management platform.</p>
<h3>Quick start</h3>
<ol>
<li>Create your first document by clicking "New Document"</li>
<li>Use the AI Assistant to help generate content</li>
<li>Organise your documents into folders</li>
<li>Invite team members to collaborate</li>
</ol>
<h3>Key Features</h3>
<ul>
<li><strong>Rich Text Editor</strong> - Format your content with ease</li>
<li><strong>AI-Powered</strong> - Generate and enhance content with AI</li>
<li><strong>Collaboration</strong> - Work together with your team in real-time</li>
<li><strong>Version History</strong> - Track changes and restore previous versions</li>
</ul>
<blockquote>Pro tip: Use keyboard shortcuts to speed up your workflow. Press <code>Ctrl+B</code> for bold, <code>Ctrl+I</code> for italic.</blockquote>`,
    folder: "Onboarding",
    status: "Published",
    visibility: "public",
    author: "Sarah Chen",
    createdAt: "2026-01-07T10:00:00Z",
    updatedAt: "2026-01-11T14:30:00Z",
  },
  "2": {
    id: "2",
    title: "API Authentication",
    content: `<h2>API Authentication</h2>
<p>Learn how to authenticate your requests to the TyneBase API.</p>
<h3>Authentication Methods</h3>
<p>TyneBase supports two authentication methods:</p>
<ol>
<li><strong>API Keys</strong> - For server-to-server communication</li>
<li><strong>OAuth 2.0</strong> - For user-facing applications</li>
</ol>
<h3>Using API Keys</h3>
<pre><code>curl -X GET "https://api.tynebase.com/v1/documents" \\
  -H "Authorization: Bearer YOUR_API_KEY"</code></pre>
<h3>Rate Limits</h3>
<p>API requests are limited to:</p>
<ul>
<li>1000 requests per minute for Pro plans</li>
<li>5000 requests per minute for Enterprise plans</li>
</ul>`,
    folder: "API Docs",
    status: "Published",
    visibility: "team",
    author: "John Smith",
    createdAt: "2026-01-05T14:00:00Z",
    updatedAt: "2026-01-10T16:45:00Z",
  },
  "3": {
    id: "3",
    title: "Team Permissions",
    content: `<h2>Understanding Team Permissions</h2>
<p>TyneBase uses role-based access control (RBAC) to manage what team members can do.</p>
<h3>Available Roles</h3>
<ul>
<li><strong>Admin</strong> - Full access to all features and settings</li>
<li><strong>Editor</strong> - Can create, edit, and publish documents</li>
<li><strong>Contributor</strong> - Can create and edit own documents</li>
<li><strong>Viewer</strong> - Read-only access to published content</li>
</ul>`,
    folder: "Admin",
    status: "Draft",
    visibility: "private",
    author: "Emily Davis",
    createdAt: "2026-01-08T09:15:00Z",
    updatedAt: "2026-01-08T09:15:00Z",
  },
};

export default function EditDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState(mockDocuments[documentId] || null);
  const [title, setTitle] = useState(document?.title || "");
  const [content, setContent] = useState(document?.content || "");
  const [status, setStatus] = useState<"Draft" | "Published">(document?.status || "Draft");
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [folder, setFolder] = useState(document?.folder || "Uncategorized");
  const [visibility, setVisibility] = useState<"public" | "private" | "team">(document?.visibility || "team");
  const [mode, setMode] = useState<"edit" | "read">("edit");
  const [kbQuestion, setKbQuestion] = useState("");
  const [kbAsking, setKbAsking] = useState(false);
  const [kbAnswer, setKbAnswer] = useState<string | null>(null);

  useEffect(() => {
    if (mockDocuments[documentId]) {
      const doc = mockDocuments[documentId];
      setDocument(doc);
      setTitle(doc.title);
      setContent(doc.content);
      setStatus(doc.status);
      setFolder(doc.folder);
      setVisibility(doc.visibility);
    }
  }, [documentId]);

  if (!document) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Document not found</h2>
          <p className="text-[var(--text-tertiary)] mb-4">The document you're looking for doesn't exist.</p>
          <Link href="/dashboard/knowledge">
            <Button variant="primary">Back to Knowledge Base</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async (data: { title: string; content: string }) => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setTitle(data.title);
    setContent(data.content);
    setIsSaving(false);
  };

  const handleAskKb = async () => {
    if (!kbQuestion.trim()) return;
    setKbAsking(true);
    setKbAnswer(null);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setKbAnswer(
      "Here’s an answer grounded in your workspace documentation. Next step: I can summarize, generate an action checklist, or suggest improvements to this doc."
    );
    setKbAsking(false);
  };

  const handlePublish = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStatus("Published");
    setIsSaving(false);
  };

  const handleUnpublish = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStatus("Draft");
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this document?")) {
      router.push("/dashboard/knowledge");
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border border-[var(--dash-border-subtle)] bg-[var(--surface-card)] rounded-2xl">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/knowledge">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)]">
            <span className="text-[var(--dash-text-muted)]">Knowledge Base</span>
            <span>/</span>
            <span>{folder}</span>
            <span>/</span>
            <span className="text-[var(--dash-text-primary)] truncate max-w-[240px]">{title || "Untitled"}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl">
            <button
              onClick={() => setMode("edit")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "edit"
                ? "bg-[var(--surface-card)] text-[var(--dash-text-primary)]"
                : "text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
                }`}
            >
              Edit
            </button>
            <button
              onClick={() => setMode("read")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "read"
                ? "bg-[var(--surface-card)] text-[var(--dash-text-primary)]"
                : "text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)]"
                }`}
            >
              Reader
            </button>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${status === "Draft"
            ? "bg-amber-500/10 text-amber-600"
            : "bg-green-500/10 text-green-600"
            }`}>
            {status === "Draft" ? (
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

          {/* Version History */}
          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="w-4 h-4" />
            History
          </Button>

          {/* Preview */}
          <Button variant="ghost" className="gap-2" onClick={() => setMode((m) => (m === "edit" ? "read" : "edit"))}>
            <Eye className="w-4 h-4" />
            {mode === "edit" ? "Preview" : "Back to editor"}
          </Button>

          {/* Publish/Unpublish */}
          {status === "Draft" ? (
            <Button variant="primary" onClick={handlePublish} disabled={isSaving}>
              <Globe className="w-4 h-4 mr-2" />
              Publish
            </Button>
          ) : (
            <Button variant="outline" onClick={handleUnpublish} disabled={isSaving}>
              <Lock className="w-4 h-4 mr-2" />
              Unpublish
            </Button>
          )}

          {/* More Options */}
          <div className="relative">
            <Button variant="ghost" className="px-2" onClick={() => setShowSettings(!showSettings)}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 mt-6">
        {mode === "edit" ? (
          <div className="flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <DocumentEditor
                initialTitle={title}
                initialContent={content}
                onSave={handleSave}
                onTitleChange={setTitle}
                onContentChange={setContent}
              />
            </div>

            {/* Settings Sidebar */}
            {showSettings && !showHistory && (
              <div className="w-80 border-l border-[var(--dash-border-subtle)] bg-[var(--surface-card)] overflow-y-auto">
                <div className="p-4 border-b border-[var(--dash-border-subtle)]">
                  <h3 className="font-semibold text-[var(--dash-text-primary)]">Document Settings</h3>
                </div>

                <div className="p-4 space-y-6">
                  {/* Folder */}
                  <div>
                    <label className="text-sm font-medium text-[var(--dash-text-secondary)] flex items-center gap-2 mb-2">
                      <Folder className="w-4 h-4" />
                      Folder
                    </label>
                    <button className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-left">
                      <span className="text-[var(--dash-text-primary)]">{folder}</span>
                      <ChevronDown className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                    </button>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="text-sm font-medium text-[var(--dash-text-secondary)] flex items-center gap-2 mb-2">
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
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${visibility === option.id
                            ? "border-[var(--brand)] bg-[var(--brand)]/10"
                            : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                            }`}
                        >
                          <option.icon className={`w-4 h-4 ${visibility === option.id
                            ? "text-[var(--brand)]"
                            : "text-[var(--dash-text-tertiary)]"
                            }`} />
                          <div className="text-left">
                            <p className="text-sm font-medium text-[var(--dash-text-primary)]">{option.label}</p>
                            <p className="text-xs text-[var(--dash-text-tertiary)]">{option.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-sm font-medium text-[var(--dash-text-secondary)] flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4" />
                      Tags
                    </label>
                    <input
                      type="text"
                      placeholder="Add tags..."
                      className="w-full px-3 py-2 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                    />
                  </div>

                  {/* Document Info */}
                  <div className="pt-4 border-t border-[var(--dash-border-subtle)]">
                    <h4 className="text-sm font-medium text-[var(--dash-text-secondary)] mb-3">Document Info</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--dash-text-muted)]">Created</span>
                        <span className="text-[var(--dash-text-secondary)]">{new Date(document.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--dash-text-muted)]">Last updated</span>
                        <span className="text-[var(--dash-text-secondary)]">{new Date(document.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--dash-text-muted)]">Author</span>
                        <span className="text-[var(--dash-text-secondary)]">{document.author}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-[var(--dash-border-subtle)] space-y-2">
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Copy className="w-4 h-4" />
                      Duplicate Document
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Copy Public Link
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={handleDelete}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Document
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Version History Sidebar */}
            {showHistory && (
              <VersionHistory
                onRestore={(versionId) => {
                  console.log("Restore version:", versionId);
                  setShowHistory(false);
                }}
                onPreview={(versionId) => {
                  console.log("Preview version:", versionId);
                }}
                onCompare={(a, b) => {
                  console.log("Compare versions:", a, b);
                }}
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6 items-start">
            <div className="col-span-12 xl:col-span-8">
              <MarkdownReader content={htmlToPlainText(content)} />
            </div>
            <div className="col-span-12 xl:col-span-4 space-y-4">
              <Card>
                <CardHeader className="pb-4 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] rounded-t-[var(--radius-lg)]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--brand)]" />
                    <CardTitle className="text-base font-semibold">Ask your knowledge base</CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Get answers grounded in your docs - ready to share with your team.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 space-y-3">
                  <textarea
                    value={kbQuestion}
                    onChange={(e) => setKbQuestion(e.target.value)}
                    placeholder="Example: What is the recommended authentication method for internal services?"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 resize-none"
                  />

                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleAskKb}
                      disabled={kbAsking || !kbQuestion.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      Ask
                    </button>
                    <button
                      onClick={() => {
                        setKbQuestion("Summarize this document into a brief + action items.");
                        setKbAnswer(null);
                      }}
                      className="text-sm font-medium text-[var(--dash-text-secondary)] hover:text-[var(--brand)] transition-colors"
                    >
                      Suggested prompt
                    </button>
                  </div>

                  {kbAsking && (
                    <div className="rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] p-4">
                      <p className="text-sm text-[var(--dash-text-secondary)]">Thinking…</p>
                      <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
                        Retrieving relevant context and drafting an answer.
                      </p>
                    </div>
                  )}

                  {kbAnswer && (
                    <div className="rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--surface-ground)] p-4">
                      <p className="text-sm font-semibold text-[var(--dash-text-primary)]">Answer</p>
                      <p className="text-sm text-[var(--dash-text-secondary)] mt-1">{kbAnswer}</p>
                      <div className="mt-3 pt-3 border-t border-[var(--dash-border-subtle)]">
                        <p className="text-xs font-semibold text-[var(--dash-text-muted)]">Citations (placeholder)</p>
                        <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
                          Add retrieval + citations once backend is wired.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
