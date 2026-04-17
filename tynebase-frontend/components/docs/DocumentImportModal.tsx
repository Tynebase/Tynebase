"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileText, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { importDocument } from "@/lib/api/documents";
import { getJobStatus, type Job } from "@/lib/api/ai";
import { useRouter } from "next/navigation";

interface DocumentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (documentId: string) => void;
}

export function DocumentImportModal({ isOpen, onClose, onSuccess }: DocumentImportModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const resetState = useCallback(() => {
    setFile(null);
    setUploading(false);
    setJobId(null);
    setJobStatus(null);
    setError(null);
    setDragActive(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleFileChange = useCallback((selectedFile: File | null) => {
    if (!selectedFile) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/zip',
      'application/x-zip-compressed',
      'text/markdown',
      'text/plain',
      'application/octet-stream',
    ];

    const allowedExtensions = ['.pdf', '.docx', '.md', '.txt'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(selectedFile.type) && !allowedExtensions.includes(fileExtension)) {
      setError('Invalid file type. Please upload PDF, DOCX, Markdown, or Plain Text files.');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit.');
      return;
    }

    setFile(selectedFile);
    setError(null);
  }, []);

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
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, [handleFileChange]);

  const pollJobStatus = useCallback(async (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 150;
    const pollInterval = 2000;

    while (attempts < maxAttempts) {
      try {
        const response = await getJobStatus(jobId);
        const job = response.job;
        setJobStatus(job);

        if (job.status === 'completed') {
          const documentId = job.result?.document_id as string;
          if (documentId) {
            setTimeout(() => {
              if (onSuccess) {
                onSuccess(documentId);
              }
              router.push(`/dashboard/knowledge/${documentId}`);
              handleClose();
            }, 1500);
          }
          return;
        }

        if (job.status === 'failed') {
          setError(job.error_message || 'Document import failed');
          setUploading(false);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      } catch (err) {
        console.error('Error polling job status:', err);
        setError(err instanceof Error ? err.message : 'Failed to check job status');
        setUploading(false);
        return;
      }
    }

    setError('Import timeout - please check job status manually');
    setUploading(false);
  }, [router, onSuccess, handleClose]);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const response = await importDocument(file);
      setJobId(response.job_id);

      await pollJobStatus(response.job_id);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload document');
      setUploading(false);
    }
  }, [file, pollJobStatus]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-[var(--dash-border-subtle)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--dash-text-primary)]">Import Document</h2>
            <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
              Upload PDF, DOCX, Markdown, or Plain Text files (max 50MB)
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!file && !uploading && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? 'border-[var(--brand)] bg-[var(--brand)]/5'
                  : 'border-[var(--dash-border-subtle)] hover:border-[var(--brand)]'
              }`}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[var(--brand)]/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-[var(--brand)]" />
                </div>
                <div>
                  <p className="text-[var(--dash-text-primary)] font-medium mb-1">
                    Drop your file here, or{' '}
                    <label className="text-[var(--brand)] hover:underline cursor-pointer">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      />
                    </label>
                  </p>
                  <p className="text-sm text-[var(--dash-text-tertiary)]">
                    Supports: PDF, DOCX, Markdown, Plain Text
                  </p>
                </div>
              </div>
            </div>
          )}

          {file && !uploading && (
            <div className="border border-[var(--dash-border-subtle)] rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-[var(--brand)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--dash-text-primary)] truncate">{file.name}</p>
                <p className="text-sm text-[var(--dash-text-tertiary)]">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--dash-text-tertiary)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {uploading && jobStatus && (
            <div className="space-y-4">
              <div className="border border-[var(--dash-border-subtle)] rounded-xl p-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center flex-shrink-0">
                    {jobStatus.status === 'completed' ? (
                      <CheckCircle className="w-6 h-6 text-[var(--status-success)]" />
                    ) : jobStatus.status === 'failed' ? (
                      <AlertTriangle className="w-6 h-6 text-[var(--status-error)]" />
                    ) : (
                      <Loader2 className="w-6 h-6 text-[var(--brand)] animate-spin" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[var(--dash-text-primary)]">
                      {jobStatus.status === 'completed' && 'Import Complete'}
                      {jobStatus.status === 'failed' && 'Import Failed'}
                      {jobStatus.status === 'processing' && 'Processing Document...'}
                      {jobStatus.status === 'pending' && 'Queued for Processing...'}
                    </p>
                    <p className="text-sm text-[var(--dash-text-tertiary)]">
                      {file?.name}
                    </p>
                  </div>
                </div>
                {jobStatus.progress > 0 && jobStatus.status !== 'completed' && (
                  <div className="w-full bg-[var(--surface-ground)] rounded-full h-2">
                    <div
                      className="bg-[var(--brand)] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${jobStatus.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {jobStatus.status === 'completed' && (
                <p className="text-sm text-[var(--status-success)] text-center">
                  Redirecting to document...
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-[var(--status-error-bg)] border border-[var(--status-error)] rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[var(--status-error)] mb-1">Import Error</p>
                <p className="text-sm text-[var(--dash-text-secondary)]">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--dash-border-subtle)]">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-6 py-2.5 rounded-xl border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-border-default)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Close' : 'Cancel'}
          </button>
          {file && !uploading && (
            <button
              onClick={handleUpload}
              className="px-6 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-medium transition-colors"
            >
              Upload & Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
