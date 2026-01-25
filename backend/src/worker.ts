import { env, isDev } from './config/env';
import { claimJob } from './utils/claimJob';

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
