import { env, isDev } from './config/env';
import { claimJob } from './utils/claimJob';
import { processAIGenerationJob } from './workers/aiGeneration';
import { processVideoIngestJob } from './workers/videoIngest';
import { processDocumentConvertJob } from './workers/documentConvert';
import { processRagIndexJob } from './workers/ragIndex';
import { processAccountDeletionJob } from './workers/accountDeletion';

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const POLL_INTERVAL_MS = 1000;

let isShuttingDown = false;

/**
 * Main worker entry point
 * Polls for pending jobs and processes them
 */
const startWorker = async () => {
  console.log(`[Worker ${WORKER_ID}] Starting...`);
  console.log(`[Worker ${WORKER_ID}] Environment: ${env.NODE_ENV}`);
  console.log(`[Worker ${WORKER_ID}] Poll interval: ${POLL_INTERVAL_MS}ms`);

  setupGracefulShutdown();

  const pollJobs = async () => {
    if (isShuttingDown) {
      return;
    }

    try {
      console.log(`[Worker ${WORKER_ID}] Polling for jobs...`);
      
      const job = await claimJob(WORKER_ID);

      if (!job) {
        if (isDev) {
          console.log(`[Worker ${WORKER_ID}] No pending jobs found`);
        }
        return;
      }

      console.log(`[Worker ${WORKER_ID}] Claimed job ${job.id} (type: ${job.type})`);
      
      if (!validateJobPayload(job)) {
        console.error(`[Worker ${WORKER_ID}] Invalid job payload for job ${job.id}`);
        return;
      }

      console.log(`[Worker ${WORKER_ID}] Processing job ${job.id}...`);
      
      await processJob(job);
    } catch (error) {
      console.error(`[Worker ${WORKER_ID}] Error polling jobs:`, error);
    }
  };

  const intervalId = setInterval(pollJobs, POLL_INTERVAL_MS);

  await pollJobs();

  process.on('SIGTERM', () => {
    console.log(`[Worker ${WORKER_ID}] Received SIGTERM, clearing interval...`);
    clearInterval(intervalId);
  });

  process.on('SIGINT', () => {
    console.log(`[Worker ${WORKER_ID}] Received SIGINT, clearing interval...`);
    clearInterval(intervalId);
  });
};

/**
 * Process a job by routing to the appropriate handler
 * @param job - Job object from database
 */
const processJob = async (job: any): Promise<void> => {
  const startTime = Date.now();
  let result: any = null;
  let resultSize = 0;
  let status: 'success' | 'failure' = 'success';
  let errorDetails: string | null = null;

  console.log(`[Worker ${WORKER_ID}] Job ${job.id} started`, {
    job_id: job.id,
    job_type: job.type,
    tenant_id: job.tenant_id,
    started_at: new Date(startTime).toISOString()
  });

  try {
    switch (job.type) {
      case 'ai_generation':
        result = await processAIGenerationJob(job);
        break;
      
      case 'video_ingestion':
      case 'video_ingest_youtube':
        result = await processVideoIngestJob(job);
        break;
      
      case 'document_convert':
        result = await processDocumentConvertJob(job);
        break;
      
      case 'rag_index':
        result = await processRagIndexJob(job);
        break;
      
      case 'gdpr_delete':
        result = await processAccountDeletionJob(job);
        break;
      
      case 'document_indexing':
        console.log(`[Worker ${WORKER_ID}] Document indexing handler not yet implemented`);
        break;
      
      case 'document_export':
        console.log(`[Worker ${WORKER_ID}] Document export handler not yet implemented`);
        break;
      
      case 'tenant_cleanup':
        console.log(`[Worker ${WORKER_ID}] Tenant cleanup handler not yet implemented`);
        break;
      
      case 'test_job':
        console.log(`[Worker ${WORKER_ID}] Test job completed successfully`);
        result = { status: 'completed' };
        break;
      
      default:
        console.error(`[Worker ${WORKER_ID}] Unknown job type: ${job.type}`);
        status = 'failure';
        errorDetails = `Unknown job type: ${job.type}`;
    }

    if (result) {
      resultSize = JSON.stringify(result).length;
    }
  } catch (error) {
    status = 'failure';
    const sanitizedError = sanitizeError(error);
    errorDetails = sanitizedError.message;
    
    console.error(`[Worker ${WORKER_ID}] Job ${job.id} failed`, {
      job_id: job.id,
      job_type: job.type,
      tenant_id: job.tenant_id,
      error_type: sanitizedError.type,
      error_message: sanitizedError.message,
      error_code: sanitizedError.code
    });
  } finally {
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[Worker ${WORKER_ID}] Job ${job.id} completed`, {
      job_id: job.id,
      job_type: job.type,
      tenant_id: job.tenant_id,
      status,
      duration_ms: duration,
      result_size_bytes: resultSize,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date(endTime).toISOString(),
      error: errorDetails
    });
  }
};

/**
 * Sanitize error for logging (remove sensitive data, stack traces)
 * @param error - Error object
 * @returns Sanitized error details
 */
const sanitizeError = (error: any): { type: string; message: string; code?: string } => {
  const errorType = error?.constructor?.name || 'Error';
  let message = 'An error occurred during job processing';
  let code: string | undefined;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error?.message) {
    message = error.message;
  }

  if (error?.code) {
    code = error.code;
  }

  const sensitivePatterns = [
    /password/gi,
    /secret/gi,
    /token/gi,
    /api[_-]?key/gi,
    /authorization/gi,
    /bearer/gi
  ];

  for (const pattern of sensitivePatterns) {
    message = message.replace(pattern, '[REDACTED]');
  }

  return {
    type: errorType,
    message: message.substring(0, 500),
    code
  };
};

/**
 * Validates job payload structure
 * @param job - Job object from database
 * @returns true if valid, false otherwise
 */
const validateJobPayload = (job: any): boolean => {
  if (!job) {
    console.error(`[Worker ${WORKER_ID}] Job is null or undefined`);
    return false;
  }

  if (!job.id || typeof job.id !== 'string') {
    console.error(`[Worker ${WORKER_ID}] Invalid job.id: ${job.id}`);
    return false;
  }

  if (!job.type || typeof job.type !== 'string') {
    console.error(`[Worker ${WORKER_ID}] Invalid job.type: ${job.type}`);
    return false;
  }

  if (!job.tenant_id || typeof job.tenant_id !== 'string') {
    console.error(`[Worker ${WORKER_ID}] Invalid job.tenant_id: ${job.tenant_id}`);
    return false;
  }

  if (!job.payload || typeof job.payload !== 'object') {
    console.error(`[Worker ${WORKER_ID}] Invalid job.payload: ${job.payload}`);
    return false;
  }

  return true;
};

/**
 * Setup graceful shutdown handlers
 */
const setupGracefulShutdown = () => {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`[Worker ${WORKER_ID}] Received ${signal}, shutting down gracefully...`);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`[Worker ${WORKER_ID}] Shutdown complete`);
      process.exit(0);
    } catch (error) {
      console.error(`[Worker ${WORKER_ID}] Error during shutdown:`, error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startWorker().catch((error) => {
  console.error(`[Worker ${WORKER_ID}] Fatal error:`, error);
  process.exit(1);
});
