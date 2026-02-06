"use client";

import { useState, useEffect } from "react";
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
  Lock,
  Sparkles,
  Loader2,
  Wand2,
  Plus,
  Folder,
  FileText,
  Settings,
  Star,
  Heart,
  Zap,
  Target,
  Flag,
  Bell,
  Calendar,
  CheckCircle,
  MessageSquare,
  Briefcase,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { createTemplate } from "@/lib/api/templates";
import { generate, pollJobUntilComplete, Job } from "@/lib/api/ai";
import { useCredits } from "@/contexts/CreditsContext";
import { listCategories, createCategory, Category } from "@/lib/api/folders";
import { Card, CardContent } from "@/components/ui/Card";

// Icon mapping for dynamic icon rendering
const iconMap: Record<string, LucideIcon> = {
  folder: Folder,
  code: Code,
  rocket: Rocket,
  users: Users,
  shield: Shield,
  'book-open': BookOpen,
  'file-text': FileText,
  settings: Settings,
  star: Star,
  heart: Heart,
  zap: Zap,
  target: Target,
  flag: Flag,
  bell: Bell,
  calendar: Calendar,
  'check-circle': CheckCircle,
  'message-square': MessageSquare,
  briefcase: Briefcase,
};

// Available icons for selection
const availableIcons = [
  { id: 'folder', label: 'Folder' },
  { id: 'code', label: 'Code' },
  { id: 'rocket', label: 'Rocket' },
  { id: 'users', label: 'Users' },
  { id: 'shield', label: 'Shield' },
  { id: 'book-open', label: 'Book' },
  { id: 'file-text', label: 'Document' },
  { id: 'settings', label: 'Settings' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'zap', label: 'Zap' },
  { id: 'target', label: 'Target' },
  { id: 'flag', label: 'Flag' },
  { id: 'bell', label: 'Bell' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'check-circle', label: 'Check' },
  { id: 'message-square', label: 'Message' },
  { id: 'briefcase', label: 'Briefcase' },
];

// Available colors for selection
const availableColors = [
  { id: '#3b82f6', label: 'Blue' },
  { id: '#8b5cf6', label: 'Purple' },
  { id: '#ec4899', label: 'Pink' },
  { id: '#f97316', label: 'Orange' },
  { id: '#06b6d4', label: 'Cyan' },
  { id: '#10b981', label: 'Green' },
  { id: '#f59e0b', label: 'Amber' },
  { id: '#ef4444', label: 'Red' },
  { id: '#6366f1', label: 'Indigo' },
  { id: '#64748b', label: 'Slate' },
];

// Dynamic icon component
function DynamicIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = iconMap[name] || Folder;
  return <Icon className={className} style={style} />;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const { decrementCredits, refreshCredits } = useCredits();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [visibility, setVisibility] = useState<"internal" | "public">("internal");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("folder");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  
  // AI generation state
  const [useAI, setUseAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState<"deepseek" | "claude" | "gemini">("deepseek");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Fetch categories on mount
  useEffect(() => {
    async function fetchCategories() {
      try {
        setIsLoadingCategories(true);
        const response = await listCategories({ limit: 100 });
        setCategories(response.categories);
        // Set default category if categories exist
        if (response.categories.length > 0 && !category) {
          setCategory(response.categories[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setIsLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  // Create new category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      setIsCreatingCategory(true);
      setError(null);
      const response = await createCategory({
        name: newCategoryName.trim(),
        icon: newCategoryIcon,
        color: newCategoryColor,
      });
      
      // Add new category to list and select it
      setCategories(prev => [...prev, response.category]);
      setCategory(response.category.id);
      
      // Reset form
      setShowNewCategory(false);
      setNewCategoryName("");
      setNewCategoryIcon("folder");
      setNewCategoryColor("#3b82f6");
    } catch (err) {
      console.error('Failed to create category:', err);
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setIsCreatingCategory(false);
    }
  };

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
      
      // Find category name for the template
      const selectedCat = categories.find(c => c.id === category);
      
      const response = await createTemplate({
        title: title.trim(),
        description: description.trim() || undefined,
        content: content.trim(),
        category: selectedCat?.name || undefined,
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

  const selectedCategory = categories.find(c => c.id === category);
  const selectedCategoryLabel = selectedCategory?.name || 'General';

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError("Please describe the template you want to create");
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setGenerationProgress(0);

      // Build a detailed prompt for template generation
      const fullPrompt = `Create a professional documentation template for the following purpose:\n\n${aiPrompt.trim()}\n\nCategory: ${selectedCategoryLabel}\n\nRequirements:\n- Use clear markdown formatting with headers, lists, and sections\n- Include placeholder text in [brackets] where users should fill in their own content\n- Make it comprehensive but not overly long\n- Include helpful guidance comments\n- Structure it logically for the intended use case\n\nGenerate ONLY the template content in markdown format, no explanations or meta-commentary.`;

      const response = await generate({
        prompt: fullPrompt,
        model: aiModel,
        max_tokens: 3000,
      });

      // Poll for job completion
      const completedJob = await pollJobUntilComplete(
        response.job.id,
        (job: Job) => {
          setGenerationProgress(job.progress || 0);
        },
        1500,
        60
      );

      if (completedJob.status === "failed") {
        throw new Error(completedJob.error_message || "AI generation failed");
      }

      // Extract generated content from job result
      const generatedContent = (completedJob.result as any)?.content || 
                               (completedJob.result as any)?.generated_content ||
                               (completedJob.result as any)?.text || "";
      
      if (!generatedContent) {
        throw new Error("No content was generated");
      }

      setContent(generatedContent);
      
      // Auto-fill title if empty
      if (!title.trim()) {
        // Extract a title from the prompt or first line
        const suggestedTitle = aiPrompt.trim().slice(0, 60) + (aiPrompt.length > 60 ? "..." : "");
        setTitle(suggestedTitle);
      }

      // Collapse AI section after successful generation
      setUseAI(false);

      // Update credits based on model cost
      const modelCost = modelOptions.find(m => m.id === aiModel)?.credits || 1;
      decrementCredits(modelCost);
      refreshCredits();
    } catch (err) {
      console.error("AI generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to generate template with AI");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const modelOptions = [
    { id: "deepseek", label: "DeepSeek", description: "Fast & economical", credits: 1 },
    { id: "claude", label: "Claude", description: "Highest quality", credits: 5 },
    { id: "gemini", label: "Gemini", description: "Balanced", credits: 2 },
  ] as const;

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
            <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Create a Template</h1>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
              Create a reusable template for your team or let AI help you
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)]">
                  Category *
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCategory(!showNewCategory)}
                  className="text-xs text-[var(--brand)] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {showNewCategory ? 'Cancel' : 'New Category'}
                </button>
              </div>

              {/* New Category Form */}
              {showNewCategory && (
                <div className="mb-4 p-4 border border-[var(--dash-border-subtle)] rounded-lg bg-[var(--surface-ground)] space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--dash-text-tertiary)] mb-1">
                      Category Name
                    </label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g., Engineering"
                      className="w-full px-3 py-2 bg-white border border-[var(--dash-border-subtle)] rounded-lg text-sm text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-[var(--dash-text-tertiary)] mb-1">
                      Icon
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableIcons.map((icon) => {
                        const isSelected = newCategoryIcon === icon.id;
                        return (
                          <button
                            key={icon.id}
                            type="button"
                            onClick={() => setNewCategoryIcon(icon.id)}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-[var(--brand)] text-white"
                                : "bg-[var(--surface-elevated)] text-[var(--dash-text-secondary)] hover:bg-[var(--surface-elevated-hover)]"
                            }`}
                            title={icon.label}
                          >
                            <DynamicIcon name={icon.id} className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-[var(--dash-text-tertiary)] mb-1">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableColors.map((color) => {
                        const isSelected = newCategoryColor === color.id;
                        return (
                          <button
                            key={color.id}
                            type="button"
                            onClick={() => setNewCategoryColor(color.id)}
                            className={`w-8 h-8 rounded-full transition-all ${
                              isSelected ? "ring-2 ring-offset-2 ring-[var(--brand)]" : ""
                            }`}
                            style={{ backgroundColor: color.id }}
                            title={color.label}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-3 pt-2 border-t border-[var(--dash-border-subtle)]">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${newCategoryColor}15` }}
                    >
                      <DynamicIcon name={newCategoryIcon} className="w-5 h-5" style={{ color: newCategoryColor }} />
                    </div>
                    <span className="text-sm font-medium text-[var(--dash-text-primary)]">
                      {newCategoryName || 'Category Preview'}
                    </span>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={isCreatingCategory || !newCategoryName.trim()}
                      className="ml-auto"
                    >
                      {isCreatingCategory ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Category Selection */}
              {isLoadingCategories ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--dash-text-tertiary)]" />
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-[var(--dash-text-tertiary)]">
                  <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No categories yet. Create one above!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {categories.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          isSelected
                            ? "border-[var(--brand)] bg-[var(--brand)]/5"
                            : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                        }`}
                      >
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${cat.color}15` }}
                        >
                          <DynamicIcon name={cat.icon} className="w-5 h-5" style={{ color: cat.color }} />
                        </div>
                        <span className={`text-sm font-medium text-center truncate w-full ${
                          isSelected 
                            ? "text-[var(--brand)]" 
                            : "text-[var(--dash-text-secondary)]"
                        }`}>
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
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

            {/* AI Generation Toggle */}
            <div className="border border-[var(--dash-border-subtle)] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setUseAI(!useAI)}
                className={`w-full flex items-center justify-between p-4 transition-colors ${
                  useAI 
                    ? "bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-[var(--dash-border-subtle)]" 
                    : "hover:bg-[var(--surface-elevated)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    useAI 
                      ? "bg-gradient-to-br from-purple-500 to-blue-500" 
                      : "bg-[var(--surface-elevated)]"
                  }`}>
                    <Sparkles className={`w-5 h-5 ${useAI ? "text-white" : "text-[var(--dash-text-tertiary)]"}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-[var(--dash-text-primary)]">Generate with AI</p>
                    <p className="text-xs text-[var(--dash-text-tertiary)]">
                      Describe what you need and let AI create the template
                    </p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  useAI ? "bg-[var(--brand)]" : "bg-[var(--dash-border-default)]"
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                    useAI ? "translate-x-5 ml-0.5" : "translate-x-0.5"
                  }`} />
                </div>
              </button>

              {/* AI Generation Form */}
              {useAI && (
                <div className="p-4 space-y-4 bg-[var(--surface-ground)]">
                  {/* AI Prompt */}
                  <div>
                    <label htmlFor="aiPrompt" className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                      Describe your template
                    </label>
                    <textarea
                      id="aiPrompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g., A technical RFC document for proposing new features, with sections for problem statement, proposed solution, alternatives considered, and implementation plan..."
                      rows={3}
                      disabled={isGenerating}
                      className="w-full px-4 py-3 bg-white border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Model Selection */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                      AI Model
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {modelOptions.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => setAiModel(model.id)}
                          disabled={isGenerating}
                          className={`p-3 rounded-lg border transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed ${
                            aiModel === model.id
                              ? "border-[var(--brand)] bg-[var(--brand)]/5"
                              : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                          }`}
                        >
                          <p className={`text-sm font-medium ${
                            aiModel === model.id 
                              ? "text-[var(--brand)]" 
                              : "text-[var(--dash-text-primary)]"
                          }`}>
                            {model.label}
                          </p>
                          <p className="text-xs text-[var(--dash-text-tertiary)] mt-0.5">
                            {model.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleAIGenerate}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="w-full gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating{generationProgress > 0 ? ` (${generationProgress}%)` : "..."}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Generate Template
                      </>
                    )}
                  </Button>
                </div>
              )}
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
                {content ? "Edit the generated content or write your own" : "Use markdown formatting for rich content"}
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
