/**
 * Job interface matching the job_queue table schema
 */
export interface Job {
    id: string;
    tenant_id: string;
    type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    payload: Record<string, any>;
    result: Record<string, any>;
    worker_id: string | null;
    attempts: number;
    next_retry_at: string | null;
    created_at: string;
    completed_at: string | null;
}
/**
 * Atomically claims a pending job from the queue using FOR UPDATE SKIP LOCKED
 * This prevents race conditions when multiple workers are running
 *
 * @param workerId - Unique identifier for this worker instance
 * @returns Claimed job or null if no jobs available
 */
export declare const claimJob: (workerId: string) => Promise<Job | null>;
//# sourceMappingURL=claimJob.d.ts.map