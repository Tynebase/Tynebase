"use client";

import { useState, useRef } from "react";
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
import { uploadVideo, transcribeYouTube, pollJobUntilComplete, type Job } from "@/lib/api/ai";

type VideoSource = "upload" | "youtube" | "url";
type ProcessingStatus = "idle" | "processing" | "complete" | "error";

interface ProcessedVideo {
  id: number;
  title: string;
  thumbnail: string;
  duration: string;
  source: VideoSource;
  status: ProcessingStatus;
  createdAt: string;
  wordCount?: number;
}

const recentVideos: ProcessedVideo[] = [
  {
    id: 1,
    title: "Product Demo - Q4 Features",
    thumbnail: "",
    duration: "12:34",
    source: "youtube",
    status: "complete",
    createdAt: "2 hours ago",
    wordCount: 2847,
  },
  {
    id: 2,
    title: "Customer Onboarding Walkthrough",
    thumbnail: "",
    duration: "8:21",
    source: "upload",
    status: "complete",
    createdAt: "Yesterday",
    wordCount: 1923,
  },
  {
    id: 3,
    title: "API Integration Tutorial",
    thumbnail: "",
    duration: "15:45",
    source: "url",
    status: "processing",
    createdAt: "Just now",
  },
];

export default function VideoPage() {
  const router = useRouter();
  const [activeSource, setActiveSource] = useState<VideoSource>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (validateVideoFile(file)) {
        setSelectedFile(file);
        setError(null);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateVideoFile(file)) {
        setSelectedFile(file);
        setError(null);
      }
    }
  };

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
      const response = await transcribeYouTube({ url: youtubeUrl.trim() });
      const job = response.data.job;
      setCurrentJob(job);
      
      const completedJob = await pollJobUntilComplete(
        job.id,
        (updatedJob) => {
          setCurrentJob(updatedJob);
          setProgress(updatedJob.progress || 0);
        }
      );
      
      if (completedJob.status === 'completed' && completedJob.result?.document_id) {
        router.push(`/dashboard/knowledge/${completedJob.result.document_id}`);
      } else if (completedJob.status === 'failed') {
        setError(completedJob.error_message || 'Video processing failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process YouTube video');
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
      const response = await uploadVideo(selectedFile);
      const job = response.data.job;
      setCurrentJob(job);
      
      const completedJob = await pollJobUntilComplete(
        job.id,
        (updatedJob) => {
          setCurrentJob(updatedJob);
          setProgress(updatedJob.progress || 0);
        }
      );
      
      if (completedJob.status === 'completed' && completedJob.result?.document_id) {
        router.push(`/dashboard/knowledge/${completedJob.result.document_id}`);
      } else if (completedJob.status === 'failed') {
        setError(completedJob.error_message || 'Video upload failed');
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
          <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mb-1">
            <Link href="/dashboard/ai-assistant" className="hover:text-[var(--brand)]">AI Assistant</Link>
            <span>/</span>
            <span>From Video</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">Generate from Video</h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Transform videos into comprehensive documentation automatically
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="xl:col-span-8 flex flex-col gap-8 min-h-0">
          {/* Source Selection */}
          <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-5">Select Video Source</h2>

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
                      Supports MP4, MOV, AVI, WebM (max 500MB)
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
                        placeholder="https://example.com/video.mp4"
                        className="w-full pl-11 pr-4 py-3 bg-[var(--surface-ground)] border border-[var(--dash-border-subtle)] rounded-lg text-[var(--dash-text-primary)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                      />
                    </div>
                    <button
                      onClick={handleProcessYouTube}
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
            <h2 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-5">Output Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <label className="flex items-start gap-3 p-5 border border-[var(--dash-border-subtle)] rounded-lg cursor-pointer hover:border-[var(--brand)] transition-colors">
                <input type="checkbox" defaultChecked className="mt-1 accent-[var(--brand)]" />
                <div>
                  <p className="font-medium text-[var(--dash-text-primary)]">Full Transcript</p>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Complete word-by-word transcription</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-5 border border-[var(--dash-border-subtle)] rounded-lg cursor-pointer hover:border-[var(--brand)] transition-colors">
                <input type="checkbox" defaultChecked className="mt-1 accent-[var(--brand)]" />
                <div>
                  <p className="font-medium text-[var(--dash-text-primary)]">Summary</p>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">AI-generated key points</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-5 border border-[var(--dash-border-subtle)] rounded-lg cursor-pointer hover:border-[var(--brand)] transition-colors">
                <input type="checkbox" defaultChecked className="mt-1 accent-[var(--brand)]" />
                <div>
                  <p className="font-medium text-[var(--dash-text-primary)]">Article</p>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">Formatted documentation</p>
                </div>
              </label>
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
              {recentVideos.map((video) => (
                <div key={video.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-[var(--surface-hover)] transition-colors group">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-20 h-12 rounded-lg bg-[var(--surface-ground)] flex items-center justify-center flex-shrink-0">
                      <Video className="w-6 h-6 text-[var(--dash-text-muted)]" />
                    </div>
                    <div className="flex-1 min-w-0 sm:hidden">
                      <h3 className="font-medium text-[var(--dash-text-primary)] truncate">{video.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-[var(--dash-text-tertiary)] mt-1">
                        <Clock className="w-3 h-3" />
                        {video.duration}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 hidden sm:block">
                    <h3 className="font-medium text-[var(--dash-text-primary)] truncate">{video.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-[var(--dash-text-tertiary)] mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {video.duration}
                      </span>
                      <span>{video.createdAt}</span>
                      {video.wordCount && <span>{video.wordCount.toLocaleString()} words</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-0 border-[var(--dash-border-subtle)] pt-2 sm:pt-0">
                    <span className="text-xs text-[var(--dash-text-tertiary)] sm:hidden">{video.createdAt}</span>
                    <div className="flex items-center gap-3 ml-auto">
                      {video.status === "complete" ? (
                        <span className="flex items-center gap-1 text-sm text-[var(--status-success)]">
                          <CheckCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">Complete</span>
                        </span>
                      ) : video.status === "processing" ? (
                        <span className="flex items-center gap-1 text-sm text-[var(--status-warning)]">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden sm:inline">Processing</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-[var(--status-error)]">
                          <AlertCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">Error</span>
                        </span>
                      )}
                      <Link
                        href={`/dashboard/knowledge/${video.id}`}
                        className="p-2 rounded-lg hover:bg-[var(--surface-ground)] text-[var(--dash-text-tertiary)] hover:text-[var(--brand)]"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
