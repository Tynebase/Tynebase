"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { apiUpload } from "@/lib/api/client";

type FileStatus = "pending" | "uploading" | "success" | "error";

type UploadFile = {
  file: File;
  id: string;
  status: FileStatus;
  progress: number;
  error?: string;
  jobId?: string;
};

export default function MarkdownImportPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const mdFiles = Array.from(newFiles).filter(
      (f) => f.name.endsWith(".md") || f.name.endsWith(".markdown")
    );

    const uploadFiles: UploadFile[] = mdFiles.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: "pending" as FileStatus,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (uploadFile: UploadFile): Promise<void> => {
    const formData = new FormData();
    formData.append("file", uploadFile.file);

    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: "uploading" as FileStatus, progress: 50 } : f
      )
    );

    try {
      const response = await apiUpload<{ job_id: string; message: string }>(
        "/api/documents/import",
        formData
      );

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "success" as FileStatus, progress: 100, jobId: response?.job_id }
            : f
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "error" as FileStatus, progress: 0, error: errorMessage }
            : f
        )
      );
    }
  };

  const startUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    for (const file of pendingFiles) {
      await uploadFile(file);
    }

    setIsUploading(false);
  };

  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div className="flex flex-col gap-6 min-h-[70vh]">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/knowledge/imports"
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] hover:border-[var(--dash-border-default)] transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--dash-text-secondary)]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--dash-text-primary)]">
            Import Markdown Files
          </h1>
          <p className="text-[var(--dash-text-tertiary)] mt-1">
            Batch import .md files with automatic RAG indexing
          </p>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${
          isDragging
            ? "border-[var(--brand)] bg-[var(--brand)]/5"
            : "border-[var(--dash-border-subtle)] bg-[var(--surface-card)]"
        }`}
      >
        <input
          type="file"
          accept=".md,.markdown"
          multiple
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload
          className={`w-12 h-12 mx-auto mb-4 ${
            isDragging ? "text-[var(--brand)]" : "text-[var(--dash-text-muted)]"
          }`}
        />
        <p className="text-lg font-medium text-[var(--dash-text-primary)]">
          Drop Markdown files here
        </p>
        <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
          or click to browse. Supports .md and .markdown files.
        </p>
      </div>

      {files.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-[var(--surface-ground)] border-b border-[var(--dash-border-subtle)]">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-[var(--dash-text-primary)]">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </span>
              {successCount > 0 && (
                <span className="text-xs text-[var(--status-success)]">
                  {successCount} uploaded
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-xs text-[var(--status-error)]">
                  {errorCount} failed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFiles([])}
                className="px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)] transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={startUpload}
                disabled={isUploading || pendingCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {pendingCount > 0 ? `(${pendingCount})` : "All"}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="divide-y divide-[var(--dash-border-subtle)] max-h-96 overflow-y-auto">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--surface-hover)] transition-colors"
              >
                <FileText className="w-5 h-5 text-[var(--dash-text-muted)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--dash-text-primary)] truncate">
                    {f.file.name}
                  </p>
                  <p className="text-xs text-[var(--dash-text-muted)]">
                    {(f.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {f.status === "pending" && (
                    <span className="text-xs text-[var(--dash-text-muted)]">Pending</span>
                  )}
                  {f.status === "uploading" && (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--brand)]" />
                  )}
                  {f.status === "success" && (
                    <CheckCircle className="w-4 h-4 text-[var(--status-success)]" />
                  )}
                  {f.status === "error" && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-[var(--status-error)]" />
                      <span className="text-xs text-[var(--status-error)]">{f.error}</span>
                    </div>
                  )}
                  {f.status === "pending" && (
                    <button
                      onClick={() => removeFile(f.id)}
                      className="p-1 hover:bg-[var(--surface-ground)] rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-[var(--dash-text-muted)]" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {successCount > 0 && !isUploading && (
        <div className="bg-[var(--status-success-bg)] border border-[var(--status-success)]/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[var(--status-success)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-[var(--dash-text-primary)]">
                {successCount} file{successCount !== 1 ? "s" : ""} uploaded successfully
              </p>
              <p className="text-sm text-[var(--dash-text-tertiary)] mt-1">
                Files are being processed for RAG indexing. This may take a few moments.
              </p>
              <Link
                href="/dashboard/knowledge"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] hover:underline mt-2"
              >
                View Documents →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
