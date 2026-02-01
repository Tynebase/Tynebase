"use client";

import { useEffect, useState, useCallback } from "react";
import { getJobStatus, type Job } from "@/lib/api/ai";
import { Progress, CircularProgress } from "./Progress";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export interface JobStatusTrackerProps {
  jobId: string;
  onComplete?: (job: Job) => void;
  onError?: (error: string) => void;
  pollInterval?: number;
  maxAttempts?: number;
  showProgress?: boolean;
  variant?: "default" | "compact" | "inline";
  className?: string;
}

const statusLabels: Record<Job["status"], string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

const statusIcons: Record<Job["status"], React.ReactElement> = {
  pending: (
    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  processing: (
    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  ),
  completed: (
    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  failed: (
    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function JobStatusTracker({
  jobId,
  onComplete,
  onError,
  pollInterval = 2000,
  maxAttempts = 150,
  showProgress = true,
  variant = "default",
  className,
}: JobStatusTrackerProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isPolling, setIsPolling] = useState(true);

  const fetchJobStatus = useCallback(async () => {
    try {
      const response = await getJobStatus(jobId);
      const jobData = response.job;
      setJob(jobData);

      if (jobData.status === "completed") {
        setIsPolling(false);
        if (onComplete) {
          onComplete(jobData);
        }
      } else if (jobData.status === "failed") {
        setIsPolling(false);
        const errorMsg = jobData.error_message || "Job processing failed";
        setError(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch job status";
      setError(errorMsg);
      setIsPolling(false);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [jobId, onComplete, onError]);

  useEffect(() => {
    if (!isPolling) return;

    if (attempts >= maxAttempts) {
      const timeoutError = "Job polling timeout - maximum attempts reached";
      setError(timeoutError);
      setIsPolling(false);
      if (onError) {
        onError(timeoutError);
      }
      return;
    }

    fetchJobStatus();

    const interval = setInterval(() => {
      setAttempts((prev) => prev + 1);
      fetchJobStatus();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [isPolling, attempts, maxAttempts, pollInterval, fetchJobStatus, onError]);

  const handleRetry = () => {
    setError(null);
    setAttempts(0);
    setIsPolling(true);
  };

  if (!job && !error) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <CircularProgress value={0} size={24} variant="default" />
        <span className="text-sm text-[var(--text-secondary)]">Loading job status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" className={className}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-medium">Job Failed</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (!job) return null;

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {statusIcons[job.status]}
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {statusLabels[job.status]}
        </span>
        {job.status === "processing" && showProgress && job.progress > 0 && (
          <span className="text-xs text-[var(--text-secondary)]">
            ({Math.round(job.progress)}%)
          </span>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-section)]", className)}>
        {statusIcons[job.status]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {statusLabels[job.status]}
          </p>
          {job.status === "processing" && showProgress && (
            <Progress value={job.progress} size="sm" className="mt-1" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-section)]", className)}>
      <div className="flex items-start gap-3">
        {statusIcons[job.status]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              {statusLabels[job.status]}
            </h4>
            {job.status === "processing" && showProgress && job.progress > 0 && (
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {Math.round(job.progress)}%
              </span>
            )}
          </div>

          {job.status === "processing" && showProgress && (
            <Progress value={job.progress} size="md" className="mb-2" />
          )}

          <div className="text-xs text-[var(--text-tertiary)] space-y-1">
            <p>Job ID: {job.id}</p>
            <p>Type: {job.type}</p>
            <p>Created: {new Date(job.created_at).toLocaleString()}</p>
            {job.started_at && (
              <p>Started: {new Date(job.started_at).toLocaleString()}</p>
            )}
            {job.completed_at && (
              <p>Completed: {new Date(job.completed_at).toLocaleString()}</p>
            )}
          </div>

          {job.status === "completed" && job.result && (
            <div className="mt-3 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-xs font-medium text-green-800 dark:text-green-200">
                Job completed successfully
              </p>
            </div>
          )}

          {job.status === "failed" && job.error_message && (
            <Alert variant="error" className="mt-3">
              <p className="text-sm">{job.error_message}</p>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

export interface UseJobStatusOptions {
  pollInterval?: number;
  maxAttempts?: number;
  autoStart?: boolean;
}

export function useJobStatus(
  jobId: string | null,
  options: UseJobStatusOptions = {}
) {
  const { pollInterval = 2000, maxAttempts = 150, autoStart = true } = options;
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(autoStart);

  const fetchJobStatus = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    try {
      const response = await getJobStatus(jobId);
      const jobData = response.job;
      setJob(jobData);
      setError(null);

      if (jobData.status === "completed" || jobData.status === "failed") {
        setIsPolling(false);
        if (jobData.status === "failed") {
          setError(jobData.error_message || "Job processing failed");
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch job status";
      setError(errorMsg);
      setIsPolling(false);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !isPolling) return;

    fetchJobStatus();

    const interval = setInterval(fetchJobStatus, pollInterval);

    return () => clearInterval(interval);
  }, [jobId, isPolling, pollInterval, fetchJobStatus]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
    setError(null);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  const reset = useCallback(() => {
    setJob(null);
    setError(null);
    setIsLoading(false);
    setIsPolling(autoStart);
  }, [autoStart]);

  return {
    job,
    error,
    isLoading,
    isPolling,
    startPolling,
    stopPolling,
    reset,
    refetch: fetchJobStatus,
  };
}
