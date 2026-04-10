export interface CompleteJobParams {
    jobId: string;
    result?: Record<string, any>;
}
export interface CompletedJob {
    id: string;
    tenant_id: string;
    type: string;
    status: 'completed';
    payload: Record<string, any>;
    result: Record<string, any>;
    worker_id: string | null;
    attempts: number;
    created_at: string;
    completed_at: string;
}
/**
 * Marks a job as completed and stores the result
 *
 * @param params - Job ID and optional result data
 * @returns The updated job record
 * @throws Error if validation fails or database update fails
 *
 * @example
 * ```typescript
 * const completedJob = await completeJob({
 *   jobId: '123e4567-e89b-12d3-a456-426614174000',
 *   result: { output: 'Generated content', tokens: 1500 }
 * });
 * ```
 */
export declare const completeJob: (params: CompleteJobParams) => Promise<CompletedJob>;
//# sourceMappingURL=completeJob.d.ts.map