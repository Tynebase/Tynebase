"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Video,
  Upload,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Youtube,
  Globe,
  Loader2,
  FileVideo,
} from "lucide-react";
import { uploadVideo, transcribeYouTube, transcribeDirectURL, pollJobUntilComplete, listMediaJobs, type Job, type MediaJob, type OutputOptions } from "@/lib/api/ai";
import { useCredits } from "@/contexts/CreditsContext";

type VideoSource = "upload" | "youtube" | "url";
type ProcessingStatus = "idle" | "processing" | "complete" | "error";

interface UIOutputOptions {
  transcript: boolean;
  summary: boolean;
  article: boolean;
}

// Base credits: 5 credits (Gemini transcription), 6 if Claude output
const BASE_CREDITS = 5;
const CLAUDE_BASE_CREDITS = 6;

const aiProviders = [
  { id: 'gemini', name: 'Gemini 2.5', desc: 'Gemini transcription + generation', credits: 2, baseCredits: BASE_CREDITS },
  { id: 'deepseek', name: 'DeepSeek', desc: 'Gemini transcription + DeepSeek generation', credits: 1, baseCredits: BASE_CREDITS },
  { id: 'claude', name: 'Claude Sonnet 4.5', desc: 'Gemini transcription + Claude generation', credits: 5, baseCredits: CLAUDE_BASE_CREDITS },
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

export default function VideoPage() {
  const router = useRouter();
  const { decrementCredits, refreshCredits } = useCredits();
  const [activeSource, setActiveSource] = useState<VideoSource>("youtube");
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Recent videos from API
  const [recentVideos, setRecentVideos] = useState<MediaJob[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  
  // Output options with credit tracking
  const [outputOptions, setOutputOptions] = useState<UIOutputOptions>({
    transcript: true, // Transcript included in base
    summary: false,
    article: false,
  });
  
  // Calculate total credits based on AI model selection
  const calculateCredits = () => {
    const provider = aiProviders.find(p => p.id === selectedProvider);
    const baseCredits = provider?.baseCredits || BASE_CREDITS;
    const modelCreditCost = provider?.credits || 2;
    let credits = baseCredits;
    // Each selected output adds the model's credit cost
    if (outputOptions.transcript) credits += modelCreditCost;
    if (outputOptions.summary) credits += modelCreditCost;
    if (outputOptions.article) credits += modelCreditCost;
    return credits;
  };
  
  const getBaseCredits = () => aiProviders.find(p => p.id === selectedProvider)?.baseCredits || BASE_CREDITS;
  
  // Load recent videos on mount
  useEffect(() => {
    const loadRecentVideos = async () => {
      try {
        setIsLoadingVideos(true);
        const response = await listMediaJobs({ type: 'video', limit: 5 });
        setRecentVideos(response.jobs);
      } catch (err) {
        console.error('Failed to load recent videos:', err);
      } finally {
        setIsLoadingVideos(false);
      }
    };
    loadRecentVideos();
  }, []);
  
  // Refresh videos after processing completes
  const refreshVideos = async () => {
    try {
      const response = await listMediaJobs({ type: 'video', limit: 5 });
      setRecentVideos(response.jobs);
    } catch (err) {
      console.error('Failed to refresh videos:', err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      void acceptFileIfValid(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      void acceptFileIfValid(file);
    }
  };

  const MAX_VIDEO_DURATION_SECONDS = 20 * 60; // 20 minutes

  const acceptFileIfValid = async (file: File) => {
    if (!validateVideoFile(file)) return;
    try {
      const duration = await readMediaDurationSeconds(file, 'video');
      if (Number.isFinite(duration) && duration > MAX_VIDEO_DURATION_SECONDS) {
        const mins = Math.ceil(duration / 60);
        setError(`Video is ~${mins} minutes. Maximum allowed is 20 minutes.`);
        return;
      }
    } catch {
      // If we can't determine duration client-side, defer to server-side check
    }
    setSelectedFile(file);
    setError(null);
  };

  const readMediaDurationSeconds = (file: File, kind: 'video' | 'audio'): Promise<number> =>
    new Promise((resolve, reject) => {
      const el = document.createElement(kind);
      el.preload = 'metadata';
      const url = URL.createObjectURL(file);
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(el.duration);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read media metadata'));
      };
      el.src = url;
    });

  const validateVideoFile = (file: File): boolean => {
    const maxSize = 500 * 1024 * 1024; // 500MB
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

    if (file.size > maxSize) {
      setError('File size must be less than 500MB');
      return false;
    }

    if (!allowedTypes.includes(file.type)) {
      setError('Only MP4, MOV, AVI, and WebM files are supported');
      return false;
    }

    return true;
  };

  const handleProcessYouTube = async () => {
    if (!youtubeUrl.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    
    try {
      const apiOptions: OutputOptions = {
        generate_transcript: outputOptions.transcript,
        generate_summary: outputOptions.summary,
        generate_article: outputOptions.article,
        ai_model: selectedProvider as 'deepseek' | 'gemini' | 'claude',
      };
      
      const response = await transcribeYouTube({ url: youtubeUrl.trim(), output_options: apiOptions });
      const job = response.job;
      setCurrentJob(job);
      
      const completedJob = await pollJobUntilComplete(
        job.id,
        (updatedJob) => {
          setCurrentJob(updatedJob);
          setProgress(updatedJob.progress || 0);
        }
      );
      
      const docId = completedJob.result?.document_id || completedJob.result?.doc_id || completedJob.result?.id;
      
      if (completedJob.status === 'completed' && docId) {
        const creditsCharged = typeof completedJob.result?.credits_charged === 'number'
          ? completedJob.result.credits_charged
          : calculateCredits();
        decrementCredits(creditsCharged);
        refreshCredits();
        await refreshVideos();
        router.push(`/dashboard/knowledge/${docId}`);
      } else if (completedJob.status === 'completed' && !docId) {
        console.error('YouTube job completed but no document ID found in result:', completedJob.result);
        setError('Video processed but could not be saved (missing ID). Please contact support.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process YouTube video');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessDirectURL = async () => {
    if (!videoUrl.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    
    try {
      const apiOptions: OutputOptions = {
        generate_transcript: outputOptions.transcript,
        generate_summary: outputOptions.summary,
        generate_article: outputOptions.article,
        ai_model: selectedProvider as 'deepseek' | 'gemini' | 'claude',
      };
      
      const response = await transcribeDirectURL({
        url: videoUrl.trim(),
        output_options: apiOptions,
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
      
      const docId = completedJob.result?.document_id || completedJob.result?.doc_id || completedJob.result?.id;
      
      if (completedJob.status === 'completed' && docId) {
        const creditsCharged = typeof completedJob.result?.credits_charged === 'number'
          ? completedJob.result.credits_charged
          : calculateCredits();
        decrementCredits(creditsCharged);
        refreshCredits();
        await refreshVideos();
        router.push(`/dashboard/knowledge/${docId}`);
      } else if (completedJob.status === 'completed' && !docId) {
        console.error('Direct URL job completed but no document ID found in result:', completedJob.result);
        setError('Video processed but could not be saved (missing ID). Please contact support.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process video URL');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessUpload = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    
    try {
      const apiOptions: OutputOptions = {
        generate_transcript: outputOptions.transcript,
        generate_summary: outputOptions.summary,
        generate_article: outputOptions.article,
        ai_model: selectedProvider as 'deepseek' | 'gemini' | 'claude',
      };
      
      const response = await uploadVideo(selectedFile, apiOptions);
      const job = response.job;
      setCurrentJob(job);
      
      const completedJob = await pollJobUntilComplete(
        job.id,
        (updatedJob) => {
          setCurrentJob(updatedJob);
          setProgress(updatedJob.progress || 0);
        }
      );
      
      const docId = completedJob.result?.document_id || completedJob.result?.doc_id || completedJob.result?.id;
      
      if (completedJob.status === 'completed' && docId) {
        const creditsCharged = typeof completedJob.result?.credits_charged === 'number'
          ? completedJob.result.credits_charged
          : calculateCredits();
        decrementCredits(creditsCharged);
        refreshCredits();
        await refreshVideos();
        router.push(`/dashboard/knowledge/${docId}`);
      } else if (completedJob.status === 'completed' && !docId) {
        console.error('Video job completed but no document ID found in result:', completedJob.result);
        setError('Video processed but could not be saved (missing ID). Please contact support.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
    } finally {
      setIsProcessing(false);
    }
  };

  const sourceOptions = [
    { id: "youtube" as VideoSource, label: "YouTube", icon: Youtube, description: "Paste a YouTube URL" },
    { id: "upload" as VideoSource, label: "Upload", icon: Upload, description: "Upload a video file" },
    { id: "url" as VideoSource, label: "Direct URL", icon: Globe, description: "Any public video URL" },
  ];

  return (
    <div className="w-full h-full min-h-full flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Generate from Video</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Automatically transform videos into comprehensive documentation
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="xl:col-span-8 flex flex-col gap-8 min-h-0">
          {/* Source Selection */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">Select Video Source</h2>
            <p className="text-xs text-[var(--dash-text-tertiary)] mb-5">
              Maximum video length: <span className="font-medium text-[var(--dash-text-secondary)]">20 minutes</span>. Longer videos will be rejected.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">
              {sourceOptions.map((source) => (
                <button
                  key={source.id}
                  onClick={() => setActiveSource(source.id)}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${activeSource === source.id
                      ? "border-[var(--brand)] bg-[var(--brand-primary-muted)]"
                      : "border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]"
                    }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${activeSource === source.id
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)]"
                    }`}>
                    <source.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-[var(--dash-text-primary)]">{source.label}</h3>
                  <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">{source.description}</p>
                </button>
              ))}
            </div>

            {/* Input based on source */}
            {activeSource === "youtube" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    YouTube URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--dash-text-muted)]" />
                      <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="w-full pl-11 pr-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                      />
                    </div>
                    <button
                      onClick={handleProcessYouTube}
                      disabled={!youtubeUrl || isProcessing}
                      className="px-7 py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSource === "upload" && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${dragActive
                    ? "border-[var(--brand)] bg-[var(--brand-primary-muted)]"
                    : "border-[var(--dash-border-default)] hover:border-[var(--brand)]"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-[var(--surface-ground)] rounded-lg">
                      <FileVideo className="w-10 h-10 text-[var(--brand)]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--dash-text-primary)] truncate">{selectedFile.name}</p>
                        <p className="text-sm text-[var(--dash-text-tertiary)]">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--status-error)] transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <button
                      onClick={handleProcessUpload}
                      disabled={isProcessing}
                      className="w-full px-7 py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing ({progress}%)
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Transcript
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto text-[var(--dash-text-muted)] mb-4" />
                    <p className="text-[var(--dash-text-primary)] font-medium mb-2">
                      Drag and drop your video here
                    </p>
                    <p className="text-sm text-[var(--dash-text-tertiary)] mb-4">
                      Supports MP4, MOV, AVI, WebM (max 500MB, max 20 minutes)
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 border border-[var(--dash-border-default)] rounded-lg text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors"
                    >
                      Choose File
                    </button>
                  </>
                )}
              </div>
            )}

            {activeSource === "url" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--dash-text-secondary)] mb-2">
                    Video URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--dash-text-muted)]" />
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://vimeo.com/... or any video URL"
                        className="w-full pl-11 pr-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                      />
                    </div>
                    <button
                      onClick={handleProcessDirectURL}
                      disabled={!videoUrl || isProcessing}
                      className="px-7 py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--dash-text-tertiary)]">
                  Supports Vimeo, Dailymotion, Twitter/X, TikTok, and 1000+ other video platforms
                </p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--status-error)] mb-1">Processing Error</p>
                  <p className="text-sm text-[var(--dash-text-secondary)]">{error}</p>
                </div>
              </div>
            )}

            {/* Progress Display */}
            {isProcessing && currentJob && (
              <div className="mt-4 p-4 bg-[var(--brand-primary-muted)] border border-[var(--brand)]/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-[var(--dash-text-primary)]">Processing Video</p>
                  <p className="text-sm text-[var(--dash-text-secondary)]">{progress}%</p>
                </div>
                <div className="w-full bg-[var(--surface-ground)] rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[var(--brand)] h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-[var(--dash-text-tertiary)] mt-2">
                  {currentJob.status === 'processing' ? 'Transcribing audio...' : 'Initializing...'}
                </p>
              </div>
            )}
          </div>

          {/* Output Options */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 sm:p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">Output Options</h2>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-primary-muted)] rounded-lg">
                <Sparkles className="w-4 h-4 text-[var(--brand)]" />
                <span className="text-sm font-medium text-[var(--brand)]">{calculateCredits()} credits</span>
              </div>
            </div>
            <p className="text-sm text-[var(--dash-text-tertiary)] mb-4">
              Base: {getBaseCredits()} credits (Gemini transcription) • Each output: +{aiProviders.find(p => p.id === selectedProvider)?.credits || 2} {(aiProviders.find(p => p.id === selectedProvider)?.credits || 2) === 1 ? 'credit' : 'credits'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <label className={`flex items-start gap-3 p-5 border rounded-lg cursor-pointer transition-colors ${
                outputOptions.transcript 
                  ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]' 
                  : 'border-[var(--dash-border-subtle)] hover:border-[var(--brand)]'
              }`}>
                <input 
                  type="checkbox" 
                  checked={outputOptions.transcript}
                  onChange={(e) => setOutputOptions(prev => ({ ...prev, transcript: e.target.checked }))}
                  className="mt-1 accent-[var(--brand)]" 
                />
                <div>
                  <p className="font-medium text-[var(--dash-text-primary)]">Full Transcript</p>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Complete word-by-word transcription</p>
                  <p className="text-xs text-[var(--dash-text-tertiary)] mt-1">Included in base</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-5 border rounded-lg cursor-pointer transition-colors ${
                outputOptions.summary 
                  ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]' 
                  : 'border-[var(--dash-border-subtle)] hover:border-[var(--brand)]'
              }`}>
                <input 
                  type="checkbox" 
                  checked={outputOptions.summary}
                  onChange={(e) => setOutputOptions(prev => ({ ...prev, summary: e.target.checked }))}
                  className="mt-1 accent-[var(--brand)]" 
                />
                <div>
                  <p className="font-medium text-[var(--dash-text-primary)]">Summary</p>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">AI-generated key points</p>
                  <p className="text-xs text-[var(--brand)] mt-1">+{aiProviders.find(p => p.id === selectedProvider)?.credits || 1} {(aiProviders.find(p => p.id === selectedProvider)?.credits || 1) === 1 ? 'credit' : 'credits'}</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-5 border rounded-lg cursor-pointer transition-colors ${
                outputOptions.article 
                  ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]' 
                  : 'border-[var(--dash-border-subtle)] hover:border-[var(--brand)]'
              }`}>
                <input 
                  type="checkbox" 
                  checked={outputOptions.article}
                  onChange={(e) => setOutputOptions(prev => ({ ...prev, article: e.target.checked }))}
                  className="mt-1 accent-[var(--brand)]" 
                />
                <div>
                  <p className="font-medium text-[var(--dash-text-primary)]">Article</p>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Formatted documentation</p>
                  <p className="text-xs text-[var(--brand)] mt-1">+{aiProviders.find(p => p.id === selectedProvider)?.credits || 1} {(aiProviders.find(p => p.id === selectedProvider)?.credits || 1) === 1 ? 'credit' : 'credits'}</p>
                </div>
              </label>
            </div>
            
            {/* AI Provider Selection */}
            <div className="mt-6 pt-6 border-t border-[var(--dash-border-subtle)]">
              <p className="text-sm font-medium text-[var(--dash-text-secondary)] mb-3">AI Provider for Summary/Article:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {aiProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedProvider === provider.id
                        ? 'border-[var(--brand)] bg-[var(--brand-primary-muted)]'
                        : 'border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full border-2 ${
                        selectedProvider === provider.id ? 'border-[var(--brand)] bg-[var(--brand)]' : 'border-[var(--dash-border-default)]'
                      }`} />
                      <span className="font-medium text-[var(--dash-text-primary)]">{provider.name}</span>
                    </div>
                    <p className="text-xs text-[var(--dash-text-tertiary)] ml-5">{provider.desc}</p>
                    <p className="text-xs text-[var(--brand)] ml-5 mt-1">{provider.credits} {provider.credits === 1 ? 'credit' : 'credits'} per output</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 flex flex-col min-h-0">
          {/* Recent Videos */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-[var(--dash-border-subtle)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--dash-text-primary)]">Recent Videos</h2>
              <Link href="/dashboard/ai-assistant" className="text-sm text-[var(--brand)] hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-[var(--dash-border-subtle)]">
              {isLoadingVideos ? (
                <div className="px-6 py-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--dash-text-muted)]" />
                </div>
              ) : recentVideos.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <Video className="w-10 h-10 mx-auto text-[var(--dash-text-muted)] mb-2" />
                  <p className="text-[var(--dash-text-tertiary)]">No videos processed yet</p>
                </div>
              ) : (
                recentVideos.map((video) => (
                  <div key={video.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-[var(--surface-hover)] transition-colors group">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="w-20 h-12 rounded-lg bg-[var(--surface-ground)] flex items-center justify-center flex-shrink-0">
                        <Video className="w-6 h-6 text-[var(--dash-text-muted)]" />
                      </div>
                      <div className="flex-1 min-w-0 sm:hidden">
                        <h3 className="font-medium text-[var(--dash-text-primary)] truncate">{video.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mt-1">
                          <Clock className="w-3 h-3" />
                          {video.duration || 'Processing...'}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 hidden sm:block">
                      <h3 className="font-medium text-[var(--dash-text-primary)] truncate">{video.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-[var(--dash-text-tertiary)] mt-1">
                        {video.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {video.duration}
                          </span>
                        )}
                        <span>{formatTimeAgo(video.created_at)}</span>
                        {video.word_count && <span>{video.word_count.toLocaleString()} words</span>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-0 border-[var(--dash-border-subtle)] pt-2 sm:pt-0">
                      <span className="text-xs text-[var(--dash-text-tertiary)] sm:hidden">{formatTimeAgo(video.created_at)}</span>
                      <div className="flex items-center gap-3 ml-auto">
                        {video.status === "completed" ? (
                          <span className="flex items-center gap-1 text-sm text-[var(--status-success)]">
                            <CheckCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Complete</span>
                          </span>
                        ) : video.status === "processing" || video.status === "pending" ? (
                          <span className="flex items-center gap-1 text-sm text-[var(--status-warning)]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="hidden sm:inline">{video.status === "pending" ? "Pending" : "Processing"}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-[var(--status-error)]">
                            <AlertCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Error</span>
                          </span>
                        )}
                        {video.document_id && (
                          <Link
                            href={`/dashboard/knowledge/${video.document_id}`}
                            className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--brand)]"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
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
