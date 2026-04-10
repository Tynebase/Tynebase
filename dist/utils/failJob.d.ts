export interface FailJobParams {
    jobId: string;
    error: string;
    errorDetails?: Record<string, any>;
}
export interface FailedJob {
    id: string;
    tenant_id: string;
    type: string;
    status: 'failed';
    payload: Record<string, any>;
    result: Record<string, any>;
    worker_id: string | null;
    attempts: number;
    next_retry_at: string | null;
    created_at: string;
    completed_at: string | null;
}
/**
 * Marks a job as failed, increments attempts, and optionally schedules retry
 *
 * @param params - Job ID, error message, and optional error details
 * @returns The updated job record
 * @throws Error if validation fails or database update fails
 *
 * @example
 * ```typescript
 * const failedJob = await failJob({
 *   jobId: '123e4567-e89b-12d3-a456-426614174000',
 *   error: 'API timeout',
 *   errorDetails: { statusCode: 504, provider: 'openai' }
 * });
 * ```
 */
export declare const failJob: (params: FailJobParams) => Promise<FailedJob>;
//# sourceMappingURL=failJob.d.ts.map