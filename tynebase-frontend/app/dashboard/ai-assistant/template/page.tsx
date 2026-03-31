"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Clock,
  FolderTree,
  Lock,
  Globe,
  Wand2,
} from "lucide-react";
import { generate, pollJobUntilComplete, listRecentGenerations, type Job, type GenerationJob } from "@/lib/api/ai";
import { createTemplate, listTemplates, type Template } from "@/lib/api/templates";
import { useCredits } from "@/contexts/CreditsContext";

// AI model credit costs
const aiProviders = [
  { id: 'deepseek', name: 'DeepSeek', desc: 'Fast and economical', credits: 0.2 },
  { id: 'gemini', name: 'Gemini 2.5', desc: 'Balanced performance', credits: 1 },
  { id: 'claude', name: 'Claude Sonnet 4.5', desc: 'Highest quality output', credits: 2 },
];

// Template categories
const templateCategories = [
  { id: "general", name: "General" },
  { id: "technical", name: "Technical Documentation" },
  { id: "policy", name: "Policy & Compliance" },
  { id: "onboarding", name: "Onboarding" },
  { id: "process", name: "Process & Workflow" },
  { id: "meeting", name: "Meeting Notes" },
  { id: "report", name: "Reports" },
  { id: "guide", name: "Guides & Tutorials" },
];

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export default function AITemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { decrementCredits, refreshCredits } = useCredits();
  
  // Form state
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [visibility, setVisibility] = useState<"internal" | "public">("internal");
  const [selectedProvider, setSelectedProvider] = useState("deepseek");
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(null);
  
  // Recent templates
  const [recentTemplates, setRecentTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  
  // Load recent templates on mount
  useEffect(() => {
    const loadRecentTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        const response = await listTemplates({ limit: 5 });
        setRecentTemplates(response.templates);
      } catch (err) {
        console.error('Failed to load recent templates:', err);
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    loadRecentTemplates();
  }, []);
  
  // Pre-fill category from URL params
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setCategory(categoryParam);
    }
  }, [searchParams]);
  
  const calculateCredits = () => {
    const provider = aiProviders.find(p => p.id === selectedProvider);
    return provider?.credits || 1;
  };
  
  const refreshTemplates = async () => {
    try {
      const response = await listTemplates({ limit: 5 });
      setRecentTemplates(response.templates);
    } catch (err) {
      console.error('Failed to refresh templates:', err);
    }
  };
  
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please describe what kind of template you want to create");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgress(0);
    
    try {
      // Build the full prompt for template generation
      const categoryLabel = templateCategories.find(c => c.id === category)?.name || "General";
      const fullPrompt = `Create a professional documentation template for the following purpose:

${prompt.trim()}

Category: ${categoryLabel}

Requirements:
- Use clear markdown formatting with headers, lists, and sections
- Include placeholder text in [brackets] where users should fill in their own content
- Make it comprehensive but not overly long
- Include helpful guidance comments
- Structure it logically for the intended use case

Generate ONLY the template content in markdown format, no explanations or meta-commentary.`;

      // Call the generate API with skip_document_creation flag
      const response = await generate({
        prompt: fullPrompt,
        model: selectedProvider as 'deepseek' | 'claude' | 'gemini',
        max_tokens: 3000,
        skip_document_creation: true,
      });
      
      const job = response.job;
      setCurrentJob(job);
      
      // Poll for job completion
      const completedJob = await pollJobUntilComplete(
        job.id,
        (updatedJob) => {
          setCurrentJob(updatedJob);
          setProgress(updatedJob.progress || 0);
        },
        1500,
        60
      );
      
      if (completedJob.status === 'completed') {
        // Extract generated content from job result
        const generatedContent = (completedJob.result as any)?.content || 
                                 (completedJob.result as any)?.generated_content ||
                                 (completedJob.result as any)?.text || "";
        
        if (!generatedContent || generatedContent.trim().length === 0) {
          throw new Error("No content was generated. Please try again with a more detailed prompt.");
        }
        
        // Extract title from content if user didn't provide one
        let templateTitle = title.trim();
        let cleanedContent = generatedContent.trim();
        if (!templateTitle) {
          // Try to extract from first heading and strip it from content
          const lines = cleanedContent.split('\n');
          const firstLine = lines[0]?.trim() || '';
          if (firstLine.startsWith('#')) {
            templateTitle = firstLine.replace(/^#+\s*/, '').trim();
            // Remove the title line (and any blank line after it) from content
            lines.shift();
            while (lines.length > 0 && lines[0].trim() === '') {
              lines.shift();
            }
            cleanedContent = lines.join('\n').trim();
          }
          // Fallback to prompt-based title
          if (!templateTitle) {
            templateTitle = prompt.length <= 50 
              ? `Template: ${prompt}` 
              : `Template: ${prompt.substring(0, 47)}...`;
          }
        }
        
        // Create the template
        const templateResponse = await createTemplate({
          title: templateTitle,
          description: description.trim() || undefined,
          content: cleanedContent,
          category: categoryLabel,
          visibility,
        });
        
        // Deduct credits
        const creditsCharged = calculateCredits();
        decrementCredits(creditsCharged);
        refreshCredits();
        
        // Update UI
        setCreatedTemplateId(templateResponse.template.id);
        setSuccess(true);
        await refreshTemplates();
        
        // Redirect to template detail page after a short delay
        setTimeout(() => {
          router.push(`/dashboard/templates/${templateResponse.template.id}`);
        }, 1500);
        
      } else if (completedJob.status === 'failed') {
        throw new Error(completedJob.error_message || 'Template generation failed');
      }
      
    } catch (err) {
      console.error('Template generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate template');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="w-full h-full min-h-full flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Generate Template with AI</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Describe your template and let AI create a professional structure for you
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="xl:col-span-8 flex flex-col gap-8 min-h-0">
          {/* Main Generation Form */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-5">Template Details</h2>
            
            <div className="space-y-6">
              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Describe your template <span className="text-[var(--status-error)]">*</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., A comprehensive employee onboarding checklist for new software engineers, including equipment setup, account access, training schedule, and key contacts..."
                  rows={4}
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 resize-none"
                />
                <p className="text-xs text-[var(--dash-text-tertiary)] mt-2">
                  Be specific about the purpose, audience, and key sections you want included
                </p>
              </div>
              
              {/* Title Input (Optional) */}
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Template Title <span className="text-[var(--dash-text-tertiary)]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Leave empty to auto-generate from AI output"
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                />
              </div>
              
              {/* Description Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                  Description <span className="text-[var(--dash-text-tertiary)]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this template is for..."
                  className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                />
              </div>
              
              {/* Category & Visibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    <FolderTree className="w-4 h-4 inline mr-1.5" />
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                  >
                    {templateCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Visibility
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setVisibility("internal")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        visibility === "internal"
                          ? "border-[var(--brand)] bg-[var(--brand-primary-muted)]"
                          : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                      }`}
                    >
                      <Lock className={`w-4 h-4 ${visibility === "internal" ? "text-[var(--brand)]" : "text-[var(--dash-text-tertiary)]"}`} />
                      <span className={`text-sm font-medium ${visibility === "internal" ? "text-[var(--brand)]" : "text-[var(--dash-text-primary)]"}`}>Internal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility("public")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        visibility === "public"
                          ? "border-[var(--brand)] bg-[var(--brand-primary-muted)]"
                          : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                      }`}
                    >
                      <Globe className={`w-4 h-4 ${visibility === "public" ? "text-[var(--brand)]" : "text-[var(--dash-text-tertiary)]"}`} />
                      <span className={`text-sm font-medium ${visibility === "public" ? "text-[var(--brand)]" : "text-[var(--dash-text-primary)]"}`}>Public</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-6 p-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--status-error)] mb-1">Generation Error</p>
                  <p className="text-sm text-[var(--dash-text-secondary)]">{error}</p>
                </div>
              </div>
            )}

            {/* Success Display */}
            {success && (
              <div className="mt-6 p-4 bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--status-success)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--status-success)] mb-1">Template Created Successfully!</p>
                  <p className="text-sm text-[var(--dash-text-secondary)]">Redirecting to your new template...</p>
                </div>
              </div>
            )}

            {/* Progress Display */}
            {isProcessing && currentJob && (
              <div className="mt-6 p-4 bg-[var(--brand-primary-muted)] border border-[var(--brand)]/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-[var(--dash-text-primary)]">Generating Template</p>
                  <p className="text-sm text-[var(--dash-text-secondary)]">{progress}%</p>
                </div>
                <div className="w-full bg-[var(--surface-ground)] rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[var(--brand)] h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-[var(--dash-text-tertiary)] mt-2">
                  {currentJob.status === 'processing' ? 'AI is crafting your template...' : 'Initializing...'}
                </p>
              </div>
            )}
          </div>

          {/* AI Provider Selection */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 sm:p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">AI Model</h2>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-primary-muted)] rounded-lg">
                <Sparkles className="w-4 h-4 text-[var(--brand)]" />
                <span className="text-sm font-medium text-[var(--brand)]">{calculateCredits()} {calculateCredits() === 1 ? 'credit' : 'credits'}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {aiProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  disabled={isProcessing}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    selectedProvider === provider.id
                      ? "border-[var(--brand)] bg-[var(--brand-primary-muted)]"
                      : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      selectedProvider === provider.id ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--dash-border-default)]'
                    }`} />
                    <span className="font-semibold text-[var(--dash-text-primary)]">{provider.name}</span>
                  </div>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">{provider.desc}</p>
                  <p className="text-xs text-[var(--brand)] mt-2">{provider.credits} {provider.credits === 1 ? 'credit' : 'credits'}</p>
                </button>
              ))}
            </div>
            
            {/* Generate Button */}
            <div className="mt-6 pt-6 border-t border-[var(--dash-border-subtle)]">
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isProcessing || success}
                className="w-full px-7 py-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Template...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Template Created!
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Generate Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Recent Templates */}
        <div className="xl:col-span-4 flex flex-col min-h-0">
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">Recent Templates</h2>
              <Link href="/dashboard/templates" className="text-sm text-[var(--brand)] hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-[var(--dash-border-subtle)] overflow-auto">
              {isLoadingTemplates ? (
                <div className="px-6 py-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--dash-text-muted)]" />
                </div>
              ) : recentTemplates.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <FileText className="w-10 h-10 mx-auto text-[var(--dash-text-muted)] mb-2" />
                  <p className="text-[var(--dash-text-tertiary)]">No templates yet</p>
                  <p className="text-sm text-[var(--dash-text-muted)] mt-1">Generate your first template above!</p>
                </div>
              ) : (
                recentTemplates.map((template) => (
                  <Link
                    key={template.id}
                    href={`/dashboard/templates/${template.id}`}
                    className="block px-6 py-4 hover:bg-[var(--surface-hover)] transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--surface-ground)] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-[var(--dash-text-muted)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[var(--dash-text-primary)] truncate group-hover:text-[var(--brand)] transition-colors">
                          {template.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mt-1">
                          {template.category && (
                            <span className="px-2 py-0.5 bg-[var(--surface-ground)] rounded text-xs">
                              {template.category}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(template.created_at)}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--dash-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-3" />
                    </div>
                  </Link>
                ))
              )}
            </div>
            
            {/* Quick Links */}
            <div className="px-6 py-4 border-t border-[var(--dash-border-subtle)] mt-auto">
              <p className="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider mb-3">Quick Links</p>
              <div className="space-y-2">
                <Link
                  href="/dashboard/templates/new"
                  className="flex items-center gap-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--brand)] transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Create Template Manually
                </Link>
                <Link
                  href="/dashboard/templates"
                  className="flex items-center gap-2 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--brand)] transition-colors"
                >
                  <FolderTree className="w-4 h-4" />
                  Browse All Templates
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
