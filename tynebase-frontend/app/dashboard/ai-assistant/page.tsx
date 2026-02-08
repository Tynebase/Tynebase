"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCredits } from "@/contexts/CreditsContext";
import { useRouter } from "next/navigation";
import { Sparkles, FileText, Upload, Check, Loader2, Zap, Image, AlertCircle, CheckCircle, Link as LinkIcon, Copy, File, Shield, Search, Eye, FileCheck, X } from "lucide-react";
import { RainbowProgressBar } from "@/components/ui/RainbowProgressBar";
import { generate, pollJobUntilComplete, scrapeUrl as scrapeUrlApi, uploadLegalDocument, type Job, type LegalDocumentUploadResponse } from "@/lib/api/ai";
import { listTemplates, type Template } from "@/lib/api/templates";
import { listRecentGenerations, type GenerationJob } from "@/lib/api/ai";
import { capitalize } from "@/lib/utils";

type TabType = 'prompt' | 'scrape' | 'file';


const outputOptions = [
  { id: 'full', label: 'Full Article', desc: 'Comprehensive document' },
  { id: 'summary', label: 'Summary', desc: 'Key points overview' },
  { id: 'outline', label: 'Outline', desc: 'Structure only' },
  { id: 'template', label: 'With Template', desc: 'Use existing template structure' },
];


const aiProviders = [
  { id: 'deepseek', name: 'DeepSeek', desc: 'Fast and efficient via AWS Bedrock', badge: 'Recommended', credits: 1 },
  { id: 'gemini', name: 'Gemini 2.5', desc: 'Advanced reasoning via Google Vertex', badge: null, credits: 2 },
  { id: 'claude', name: 'Claude Sonnet 4.5', desc: 'Best for analysis & nuanced writing', badge: null, credits: 5 },
];

export default function AIAssistantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { creditsRemaining, refreshCredits, decrementCredits } = useCredits();
  
  // Get category from query params (when coming from category list)
  const categoryId = searchParams.get('category');
  const categoryName = searchParams.get('categoryName');
  
  const [activeTab, setActiveTab] = useState<TabType>('prompt');

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [outputType, setOutputType] = useState('full');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapedContent, setScrapedContent] = useState<string | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<LegalDocumentUploadResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File processing options
  const [enableOcr, setEnableOcr] = useState(true);
  const [indexForSearch, setIndexForSearch] = useState(true);
  const [preserveFormatting, setPreserveFormatting] = useState(true);

  const tabs = [
    { id: 'prompt' as TabType, icon: FileText, label: 'From Prompt', description: 'Generate from text description' },
    { id: 'scrape' as TabType, icon: LinkIcon, label: 'From URL', description: 'Extract content from web pages' },
    { id: 'file' as TabType, icon: File, label: 'From File', description: 'Import legal documents & media' },
  ];
  
  const supportedFileCategories = [
    { id: 'pdf', label: 'PDF Documents', extensions: '.pdf', icon: FileText, desc: 'PDF/A archival format supported' },
    { id: 'word', label: 'Word Documents', extensions: '.docx, .doc', icon: FileText, desc: 'Contracts, drafts, templates' },
    { id: 'excel', label: 'Excel Spreadsheets', extensions: '.xlsx, .xls', icon: FileText, desc: 'Financial data, fee agreements' },
    { id: 'powerpoint', label: 'PowerPoint', extensions: '.pptx, .ppt', icon: FileText, desc: 'Presentations, evidence' },
    { id: 'email', label: 'Email Files', extensions: '.msg, .eml', icon: FileText, desc: 'Client communications' },
    { id: 'image', label: 'Images', extensions: '.tiff, .png, .jpg, .gif', icon: Image, desc: 'Scanned docs, screenshots' },
    { id: 'text', label: 'Text Files', extensions: '.txt, .md', icon: FileText, desc: 'Plain text, markdown' },
  ];
  
  const allSupportedExtensions = '.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.msg,.eml,.tiff,.tif,.png,.jpg,.jpeg,.gif,.txt,.md';
  
  const [fileOutputOptions, setFileOutputOptions] = useState({
    extractedText: true,
    summary: false,
    article: false,
  });
  
  // Recent generations state
  const [recentGenerations, setRecentGenerations] = useState<GenerationJob[]>([]);
  const [recentGenerationsLoading, setRecentGenerationsLoading] = useState(false);
  
  const BASE_FILE_CREDITS = 5;
  const LARGE_FILE_CREDITS = 10;
  const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB hard limit
  const EXTRA_CREDIT_PER_OPTION = 1;
  
  const calculateFileCredits = () => {
    if (!selectedFile) return BASE_FILE_CREDITS;
    const baseCredits = selectedFile.size > LARGE_FILE_THRESHOLD ? LARGE_FILE_CREDITS : BASE_FILE_CREDITS;
    const modelCreditCost = aiProviders.find(p => p.id === selectedProvider)?.credits || 1;
    let aiCredits = 0;
    if (fileOutputOptions.summary) aiCredits += modelCreditCost;
    if (fileOutputOptions.article) aiCredits += modelCreditCost;
    return baseCredits + aiCredits;
  };
  
  const isFileTooLarge = selectedFile && selectedFile.size > MAX_FILE_SIZE;

  // Fetch templates and recent generations on component mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        setTemplatesLoading(true);
        const response = await listTemplates();
        setAvailableTemplates(response.templates);
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      } finally {
        setTemplatesLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  // Fetch recent generations
  useEffect(() => {
    async function fetchRecentGenerations() {
      try {
        setRecentGenerationsLoading(true);
        const response = await listRecentGenerations({ limit: 5 });
        setRecentGenerations(response.generations);
      } catch (err) {
        console.error('Failed to fetch recent generations:', err);
      } finally {
        setRecentGenerationsLoading(false);
      }
    }
    fetchRecentGenerations();
  }, []);

  // Pre-populate prompt with category context when coming from category list
  useEffect(() => {
    if (categoryName && !prompt) {
      setPrompt(`Create documentation for the "${categoryName}" category. `);
    }
  }, [categoryName, prompt]);

  const quickPrompts = [
    "Create an API documentation for a REST endpoint",
    "Write an onboarding guide for new team members",
    "Generate a troubleshooting guide for common issues",
    "Create a product release notes template",
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    
    try {
      const modelMap: Record<string, 'deepseek' | 'claude' | 'gemini'> = {
        'deepseek': 'deepseek',
        'claude': 'claude',
        'gemini': 'gemini',
      };
      
      // If using template, append template structure to prompt
      let finalPrompt = prompt.trim();
      if (outputType === 'template' && selectedTemplate) {
        const template = availableTemplates.find(t => t.id === selectedTemplate);
        if (template) {
          finalPrompt = `${prompt.trim()}\n\nUse this template structure:\n${template.content}`;
        }
      }
      
      const response = await generate({
        prompt: finalPrompt,
        model: modelMap[selectedProvider] || 'deepseek',
      });
      
      const job = response.job;
      setCurrentJob(job);
      
      const completedJob = await pollJobUntilComplete(
        job.id,
        (updatedJob) => {
          setCurrentJob(updatedJob);
          setProgress(updatedJob.progress || 0);
        }
      );
      
      if (completedJob.status === 'completed' && completedJob.result?.document_id) {
        const creditCost = aiProviders.find(p => p.id === selectedProvider)?.credits || 1;
        decrementCredits(creditCost);
        refreshCredits();
        
        // If we came from a category, assign the document to that category
        const docId = completedJob.result.document_id as string;
        if (categoryId && docId) {
          try {
            const { updateDocument } = await import('@/lib/api/documents');
            await updateDocument(docId, { category_id: categoryId });
          } catch (err) {
            console.error('Failed to assign category to document:', err);
            // Continue to redirect even if category assignment fails
          }
        }
        
        router.push(`/dashboard/knowledge/${docId}`);
      } else if (completedJob.status === 'failed') {
        setError(completedJob.error_message || 'Generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    
    setIsScraping(true);
    setError(null);
    setProgress(0);
    setScrapedContent(null);
    
    try {
      const outputTypeMap: Record<string, 'full_article' | 'summary' | 'outline' | 'raw'> = {
        'full': 'full_article',
        'summary': 'summary',
        'outline': 'outline',
        'template': 'full_article',
      };
      
      const response = await scrapeUrlApi({ 
        url: scrapeUrl.trim(),
        output_type: outputTypeMap[outputType] || 'full_article',
        ai_model: selectedProvider as 'deepseek' | 'claude' | 'gemini',
      });
      
      if (response.markdown) {
        setScrapedContent(response.markdown);
        setProgress(100);
        // Deduct actual credits from response
        decrementCredits(response.credits_charged);
        refreshCredits();
      } else {
        setError('No content extracted from URL');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape URL');
    } finally {
      setIsScraping(false);
    }
  };

  const handleSaveScrapedContent = async () => {
    if (!scrapedContent) return;
    
    try {
      const { createDocument } = await import('@/lib/api/documents');
      const response = await createDocument({
        title: `Scraped: ${scrapeUrl}`,
        content: scrapedContent,
      });
      
      if (response.document?.id) {
        router.push(`/dashboard/knowledge/${response.document.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save content');
    }
  };

  const handleCopyScrapedContent = () => {
    if (scrapedContent) {
      navigator.clipboard.writeText(scrapedContent);
    }
  };

  // File upload handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadResult(null);
      setError(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
      setError(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setError(null);
    setProgress(0);
    
    try {
      const response = await uploadLegalDocument(selectedFile, {
        enable_ocr: enableOcr,
        index_for_search: indexForSearch,
        preserve_formatting: preserveFormatting,
        generate_summary: fileOutputOptions.summary,
        generate_article: fileOutputOptions.article,
        ai_model: selectedProvider as 'deepseek' | 'gemini' | 'claude',
      });
      
      setUploadResult(response);
      setCurrentJob(response.job);
      
      // Poll for job completion
      const completedJob = await pollJobUntilComplete(
        response.job.id,
        (updatedJob) => {
          setCurrentJob(updatedJob);
          setProgress(updatedJob.progress || 0);
        }
      );
      
      if (completedJob.status === 'completed' && completedJob.result?.document_id) {
        // Use actual credit cost from backend
        const creditsCharged = typeof completedJob.result.credits_charged === 'number' 
          ? completedJob.result.credits_charged 
          : calculateFileCredits();
        decrementCredits(creditsCharged);
        refreshCredits();
        router.push(`/dashboard/knowledge/${completedJob.result.document_id}`);
      } else if (completedJob.status === 'failed') {
        setError(completedJob.error_message || 'Document processing failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-full h-full min-h-full flex flex-col gap-8">
      <RainbowProgressBar isLoading={isGenerating} />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">
            {categoryName ? `Generate for ${categoryName}` : 'AI Assistant'}
          </h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            {categoryName 
              ? `Create new documentation in the "${categoryName}" category`
              : 'Generate content with AI-powered tools'
            }
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--dash-text-muted)]">
          <Zap className="w-4 h-4 text-[var(--brand)]" />
          <span>
            {Math.floor(creditsRemaining / (aiProviders.find(p => p.id === selectedProvider)?.credits || 1))} generations remaining
            <span className="text-[var(--dash-text-muted)]"> ({creditsRemaining} credits)</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
        <div className="xl:col-span-8 flex flex-col gap-6 min-h-0">
          {/* Tab Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  activeTab === tab.id
                    ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                    : 'border-[var(--dash-border-subtle)] bg-[var(--surface-card)] hover:border-[var(--dash-border-default)]'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  activeTab === tab.id
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]'
                }`}>
                  <tab.icon className="w-5 h-5" />
                </div>
                <p className="font-semibold text-[var(--dash-text-primary)]">{tab.label}</p>
                <p className="text-sm text-[var(--dash-text-tertiary)]">{tab.description}</p>
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-5 sm:p-6 flex-1 overflow-auto">
            {activeTab === 'prompt' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Describe what you want to create
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Create a comprehensive API documentation for our user authentication endpoints including examples for login, signup, password reset, and token refresh..."
                    rows={5}
                    className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all resize-none"
                  />
                </div>

                {/* Quick Prompts */}
                <div>
                  <p className="text-sm text-[var(--dash-text-tertiary)] mb-3">Quick suggestions:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickPrompts.map((qp) => (
                      <button
                        key={qp}
                        onClick={() => setPrompt(qp)}
                        className="px-3 py-1.5 text-xs bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-full text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all"
                      >
                        {qp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Output Options */}
                <div>
                  <p className="text-sm font-medium text-[var(--dash-text-secondary)] mb-3">Output type:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {outputOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setOutputType(opt.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          outputType === opt.id
                            ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                            : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            outputType === opt.id ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--dash-border-default)]'
                          }`}>
                            {outputType === opt.id && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="font-medium text-[var(--dash-text-primary)]">{opt.label}</span>
                        </div>
                        <p className="text-xs text-[var(--dash-text-tertiary)] ml-6">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Selection - Show when 'From Template' is selected */}
                {outputType === 'template' && (
                  <div>
                    <p className="text-sm font-medium text-[var(--dash-text-secondary)] mb-3">Choose a template:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availableTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template.id)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selectedTemplate === template.id
                              ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                              : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedTemplate === template.id ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--dash-border-default)]'
                            }`}>
                              {selectedTemplate === template.id && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="font-medium text-[var(--dash-text-primary)]">{template.title}</span>
                          </div>
                          <p className="text-xs text-[var(--dash-text-tertiary)] ml-6">{template.description || 'No description'}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">Generation Failed</p>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                {currentJob && isGenerating && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Generating Content...</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Status: {capitalize(currentJob.status)} • Progress: {progress}%
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating || (outputType === 'template' && !selectedTemplate)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {outputType === 'template' ? `Generate with ${availableTemplates.find(t => t.id === selectedTemplate)?.title || 'Template'}` : 'Generate Document'}
                    </>
                  )}
                </button>
              </div>
            )}

        
        {activeTab === 'scrape' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                Enter URL to scrape
              </label>
              <input
                type="url"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full px-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
              />
              <p className="text-xs text-[var(--dash-text-muted)] mt-2">
                Extract and convert web content to markdown format using Tavily
              </p>
            </div>

            {/* Output Type Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-[var(--dash-text-secondary)]">Output type:</p>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-primary-muted)] rounded-lg">
                  <Sparkles className="w-4 h-4 text-[var(--brand)]" />
                  <span className="text-sm font-medium text-[var(--brand)]">
                    {3 + (aiProviders.find(p => p.id === selectedProvider)?.credits || 1)} credits
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--dash-text-muted)] mb-3">
                Base: 3 credits (Tavily scrape) + AI: {(aiProviders.find(p => p.id === selectedProvider)?.credits || 1)} credit ({selectedProvider})
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'full', label: 'Full Article', desc: 'Polished article with structure' },
                  { id: 'summary', label: 'Summary', desc: 'Key points and takeaways' },
                  { id: 'outline', label: 'Outline', desc: 'Hierarchical structure only' },
                  { id: 'raw', label: 'Raw', desc: 'Just Tavily markdown' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setOutputType(opt.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      outputType === opt.id
                        ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                        : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        outputType === opt.id ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--dash-border-default)]'
                      }`}>
                        {outputType === opt.id && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="font-medium text-[var(--dash-text-primary)]">{opt.label}</span>
                    </div>
                    <p className="text-xs text-[var(--dash-text-tertiary)] ml-6">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Scraping Failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {currentJob && isScraping && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Scraping URL...</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Status: {currentJob.status} • Progress: {progress}%
                    </p>
                  </div>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {scrapedContent && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-green-900">Content extracted successfully</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyScrapedContent}
                      className="px-3 py-1.5 text-sm border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-secondary)] hover:border-[var(--brand)] transition-colors flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </button>
                    <button
                      onClick={handleSaveScrapedContent}
                      className="px-3 py-1.5 text-sm bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Save as Document
                    </button>
                  </div>
                </div>
                <div className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-4 max-h-96 overflow-auto">
                  <pre className="text-sm text-[var(--dash-text-primary)] whitespace-pre-wrap font-mono">{scrapedContent}</pre>
                </div>
              </div>
            )}

            {!scrapedContent && (
              <button
                onClick={handleScrape}
                disabled={!scrapeUrl.trim() || isScraping}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4" />
                    Extract Content
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {activeTab === 'file' && (
          <div className="space-y-6">
            {/* Legal DMS Features Banner */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Legal Document Management</p>
                <p className="text-xs text-blue-700 mt-1">
                  Files are verified with SHA-256 checksums, OCR processed for searchability, and metadata preserved for legal admissibility.
                </p>
              </div>
            </div>

            {/* Drag & Drop Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive
                  ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                  : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={allSupportedExtensions}
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  dragActive ? 'bg-[var(--brand)] text-white' : 'bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]'
                }`}>
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-medium text-[var(--dash-text-primary)]">
                    {dragActive ? 'Drop your file here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
                    PDF, Word, Excel, PowerPoint, Email, Images, Text (max 500MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Selected File Preview */}
            {selectedFile && !isUploading && !uploadResult && (
              <div className="bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-xl p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[var(--brand-primary-muted)] flex items-center justify-center flex-shrink-0">
                    <File className="w-6 h-6 text-[var(--brand)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--dash-text-primary)] truncate">{selectedFile.name}</p>
                    <p className="text-sm text-[var(--dash-text-tertiary)] mt-0.5">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                      {selectedFile.size > LARGE_FILE_THRESHOLD && (
                        <span className="text-amber-600 ml-2">• Large file (+5 credits)</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={clearSelectedFile}
                    className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* File Too Large Error */}
            {isFileTooLarge && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">File Too Large</p>
                  <p className="text-sm text-red-700 mt-1">
                    Maximum file size is 500MB. Your file is {formatFileSize(selectedFile?.size || 0)}.
                  </p>
                </div>
              </div>
            )}

            {/* Output Options */}
            {selectedFile && !isUploading && !uploadResult && !isFileTooLarge && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--dash-text-secondary)]">Output Options:</p>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-primary-muted)] rounded-lg">
                    <Sparkles className="w-4 h-4 text-[var(--brand)]" />
                    <span className="text-sm font-medium text-[var(--brand)]">{calculateFileCredits()} credits</span>
                  </div>
                </div>
                <p className="text-xs text-[var(--dash-text-muted)]">
                  Base: {selectedFile.size > LARGE_FILE_THRESHOLD ? LARGE_FILE_CREDITS : BASE_FILE_CREDITS} credits 
                  {selectedFile.size > LARGE_FILE_THRESHOLD && ' (file &gt;50MB)'} • AI outputs: +{aiProviders.find(p => p.id === selectedProvider)?.credits || 1} credit each ({selectedProvider})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                    fileOutputOptions.extractedText 
                      ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]' 
                      : 'border-[var(--dash-border-subtle)] hover:border-[var(--brand)]'
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={fileOutputOptions.extractedText}
                      onChange={(e) => setFileOutputOptions(prev => ({ ...prev, extractedText: e.target.checked }))}
                      className="mt-1 accent-[var(--brand)]" 
                    />
                    <div>
                      <p className="font-medium text-[var(--dash-text-primary)]">Extracted Text</p>
                      <p className="text-sm text-[var(--dash-text-tertiary)]">Full document content</p>
                      <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Included in base</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                    fileOutputOptions.summary 
                      ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]' 
                      : 'border-[var(--dash-border-subtle)] hover:border-[var(--brand)]'
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={fileOutputOptions.summary}
                      onChange={(e) => setFileOutputOptions(prev => ({ ...prev, summary: e.target.checked }))}
                      className="mt-1 accent-[var(--brand)]" 
                    />
                    <div>
                      <p className="font-medium text-[var(--dash-text-primary)]">Summary</p>
                      <p className="text-sm text-[var(--dash-text-tertiary)]">AI-generated key points</p>
                      <p className="text-xs text-[var(--brand)] mt-1">+{aiProviders.find(p => p.id === selectedProvider)?.credits || 1} credit</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                    fileOutputOptions.article 
                      ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]' 
                      : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={fileOutputOptions.article}
                      onChange={(e) => setFileOutputOptions(prev => ({ ...prev, article: e.target.checked }))}
                      className="mt-1 accent-[var(--brand)]" 
                    />
                    <div>
                      <p className="font-medium text-[var(--dash-text-primary)]">Article</p>
                      <p className="text-sm text-[var(--dash-text-tertiary)]">Formatted documentation</p>
                      <p className="text-xs text-[var(--brand)] mt-1">+{aiProviders.find(p => p.id === selectedProvider)?.credits || 1} credit</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Processing Options (OCR, Search, Format) */}
            {selectedFile && !isUploading && !uploadResult && !isFileTooLarge && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--dash-text-secondary)]">Processing Options:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setEnableOcr(!enableOcr)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      enableOcr
                        ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                        : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="w-4 h-4 text-[var(--brand)]" />
                      <span className="font-medium text-sm text-[var(--dash-text-primary)]">OCR Processing</span>
                    </div>
                    <p className="text-xs text-[var(--dash-text-tertiary)]">Extract text from images</p>
                  </button>
                  
                  <button
                    onClick={() => setIndexForSearch(!indexForSearch)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      indexForSearch
                        ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                        : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Search className="w-4 h-4 text-[var(--brand)]" />
                      <span className="font-medium text-sm text-[var(--dash-text-primary)]">Full-Text Search</span>
                    </div>
                    <p className="text-xs text-[var(--dash-text-tertiary)]">Index for search queries</p>
                  </button>
                  
                  <button
                    onClick={() => setPreserveFormatting(!preserveFormatting)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      preserveFormatting
                        ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                        : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileCheck className="w-4 h-4 text-[var(--brand)]" />
                      <span className="font-medium text-sm text-[var(--dash-text-primary)]">Preserve Format</span>
                    </div>
                    <p className="text-xs text-[var(--dash-text-tertiary)]">Keep original formatting</p>
                  </button>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isUploading && currentJob && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Processing Document...</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {uploadResult?.checksums && (
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Checksum verified
                        </span>
                      )}
                      {!uploadResult?.checksums && `Status: ${capitalize(currentJob.status)} • Progress: ${progress}%`}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Upload Failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Upload Button */}
            {selectedFile && !isUploading && !uploadResult && !isFileTooLarge && (
              <button
                onClick={handleFileUpload}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
              >
                <Upload className="w-4 h-4" />
                Process Document ({calculateFileCredits()} credits)
              </button>
            )}

            {/* Supported File Types Grid */}
            {!selectedFile && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--dash-text-secondary)]">Supported File Types:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {supportedFileCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 p-3 bg-[var(--surface-ground)] rounded-lg"
                    >
                      <cat.icon className="w-4 h-4 text-[var(--dash-text-tertiary)]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--dash-text-primary)]">{cat.label}</p>
                        <p className="text-xs text-[var(--dash-text-muted)] truncate">{cat.extensions}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

                  </div>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-6 min-h-0">
          {/* AI Provider Settings */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
            <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <h2 className="font-semibold text-[var(--dash-text-primary)]">AI Provider</h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Choose your preferred AI model</p>
            </div>
            <div className="p-6 space-y-3">
              {aiProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${
                    selectedProvider === provider.id
                      ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                      : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedProvider === provider.id ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--dash-border-default)]'
                    }`}>
                      {selectedProvider === provider.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-[var(--dash-text-primary)]">{provider.name}</p>
                      </div>
                      <p className="text-sm text-[var(--dash-text-tertiary)]">{provider.desc}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Zap className="w-3.5 h-3.5 text-[var(--brand)]" />
                        <span className="text-xs font-medium text-[var(--dash-text-secondary)]">
                          {provider.credits} {provider.credits === 1 ? 'credit' : 'credits'} per generation
                        </span>
                      </div>
                    </div>
                  </div>
                  {provider.badge && (
                    <span className="px-2 py-1 text-xs font-medium bg-[var(--brand-primary-muted)] text-[var(--brand)] rounded-full">
                      {provider.badge}
                    </span>
                  )}
                </button>
              ))}
              <p className="text-xs text-[var(--dash-text-muted)] mt-4 flex items-center gap-1">
                <Check className="w-3 h-3 text-[var(--status-success)]" />
                All providers use EU/UK data centers for GDPR compliance.
              </p>
            </div>
          </div>

          {/* With Template Section */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
            <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <h2 className="font-semibold text-[var(--dash-text-primary)]">With Template</h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Use template structure as a guide for AI generation</p>
            </div>
            <div className="p-6">
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
                </div>
              ) : availableTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--dash-text-tertiary)]">No templates available</p>
                  <Link href="/dashboard/templates/new" className="text-sm text-[var(--brand)] hover:underline mt-2 inline-block">
                    Create your first template
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all group ${
                      selectedTemplate === template.id
                        ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                        : 'border-[var(--dash-border-subtle)] hover:border-[var(--brand)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        selectedTemplate === template.id ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--dash-border-default)] group-hover:border-[var(--brand)]'
                      }`}>
                        {selectedTemplate === template.id && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium mb-0.5 ${
                          selectedTemplate === template.id ? 'text-[var(--brand)]' : 'text-[var(--dash-text-primary)] group-hover:text-[var(--brand)]'
                        }`}>
                          {template.title}
                        </p>
                        <p className="text-xs text-[var(--dash-text-tertiary)]">{template.description || 'No description'}</p>
                      </div>
                      <FileText className={`w-4 h-4 flex-shrink-0 ${
                        selectedTemplate === template.id ? 'text-[var(--brand)]' : 'text-[var(--dash-text-muted)] group-hover:text-[var(--brand)]'
                      }`} />
                    </div>
                  </button>
                  ))}
                </div>
              )}
              
              {selectedTemplate && (
                <div className="mt-4 pt-4 border-t border-[var(--dash-border-subtle)]">
                  <button 
                    onClick={() => {
                      setOutputType('template');
                      handleGenerate();
                    }}
                    disabled={!prompt.trim() || isGenerating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate with {availableTemplates.find(t => t.id === selectedTemplate)?.title}
                      </>
                    )}
                  </button>
                  <p className="text-xs text-[var(--dash-text-muted)] mt-2 text-center">
                    Enter a prompt above to generate content using this template
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Generations */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl">
            <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)]">
              <h2 className="font-semibold text-[var(--dash-text-primary)]">Recent Generations</h2>
              <p className="text-sm text-[var(--dash-text-tertiary)]">Your AI-generated content history</p>
            </div>
            <div className="divide-y divide-[var(--dash-border-subtle)]">
              {recentGenerationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
                </div>
              ) : recentGenerations.length === 0 ? (
                <div className="text-center py-8 px-6">
                  <p className="text-sm text-[var(--dash-text-tertiary)]">No recent generations</p>
                  <p className="text-xs text-[var(--dash-text-muted)] mt-1">Generate content to see it here</p>
                </div>
              ) : (
                recentGenerations.map((gen: GenerationJob) => (
                  <div key={gen.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer" onClick={() => gen.document_id && router.push(`/dashboard/knowledge/${gen.document_id}`)}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary-muted)] flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-[var(--brand)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--dash-text-primary)]">{gen.title}</p>
                        <p className="text-sm text-[var(--dash-text-tertiary)]">{gen.type} • {formatTimeAgo(gen.created_at)}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      gen.status === 'completed' 
                        ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]' 
                        : gen.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-[var(--status-warning-bg)] text-[var(--status-warning)]'
                    }`}>
                      {capitalize(gen.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
