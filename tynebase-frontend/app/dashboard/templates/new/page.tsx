"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { 
  ArrowLeft, 
  Save, 
  Code,
  Rocket,
  Users,
  Shield,
  BookOpen,
  AlertCircle,
  Globe,
  Lock
} from "lucide-react";
import Link from "next/link";
import { createTemplate } from "@/lib/api/templates";
import { Card, CardContent } from "@/components/ui/Card";

const categoryOptions = [
  { id: 'engineering', label: 'Engineering', icon: Code, color: '#3b82f6' },
  { id: 'product', label: 'Product', icon: Rocket, color: '#8b5cf6' },
  { id: 'hr', label: 'HR & People', icon: Users, color: '#ec4899' },
  { id: 'security', label: 'Security', icon: Shield, color: '#f97316' },
  { id: 'general', label: 'General', icon: BookOpen, color: '#06b6d4' },
];

export default function NewTemplatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [visibility, setVisibility] = useState<"internal" | "public">("internal");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError("Template title is required");
      return;
    }
    
    if (!content.trim()) {
      setError("Template content is required");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      
      const response = await createTemplate({
        title: title.trim(),
        description: description.trim() || undefined,
        content: content.trim(),
        category: category || undefined,
        visibility,
      });
      
      // Redirect to templates list on success
      router.push('/dashboard/templates');
    } catch (err) {
      console.error('Failed to create template:', err);
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCategoryOption = categoryOptions.find(opt => opt.id === category) || categoryOptions[4];
  const CategoryIcon = selectedCategoryOption.icon;

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/templates">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Templates
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Create Template</h1>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
              Create a reusable template for your team
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6 min-h-0">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent className="p-6 flex flex-col gap-6 flex-1 min-h-0">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Template Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Product Requirements Document"
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this template is for..."
                rows={3}
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {categoryOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = category === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCategory(option.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                        isSelected
                          ? "border-[var(--brand)] bg-[var(--brand)]/5"
                          : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                      }`}
                    >
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${option.color}15` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: option.color }} />
                      </div>
                      <span className={`text-sm font-medium ${
                        isSelected 
                          ? "text-[var(--brand)]" 
                          : "text-[var(--dash-text-secondary)]"
                      }`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Visibility *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility("internal")}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                    visibility === "internal"
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                  }`}
                >
                  <Lock className={`w-5 h-5 mt-0.5 ${
                    visibility === "internal" 
                      ? "text-[var(--brand)]" 
                      : "text-[var(--dash-text-tertiary)]"
                  }`} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-[var(--dash-text-primary)]">Internal</p>
                    <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
                      Only visible to your team
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                    visibility === "public"
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                  }`}
                >
                  <Globe className={`w-5 h-5 mt-0.5 ${
                    visibility === "public" 
                      ? "text-[var(--brand)]" 
                      : "text-[var(--dash-text-tertiary)]"
                  }`} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-[var(--dash-text-primary)]">Public</p>
                    <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">
                      Share with the community (requires approval)
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <label htmlFor="content" className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Template Content *
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter the template content in markdown format..."
                className="flex-1 min-h-[300px] px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 resize-none font-mono text-sm"
                required
              />
              <p className="text-xs text-[var(--dash-text-muted)] mt-2">
                Use markdown formatting for rich content
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/dashboard/templates">
            <Button variant="ghost" type="button" disabled={isSaving}>
              Cancel
            </Button>
          </Link>
          <Button 
            variant="primary" 
            type="submit" 
            disabled={isSaving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </form>
    </div>
  );
}
