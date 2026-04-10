import { z } from 'zod';
declare const JobTypeSchema: z.ZodEnum<["ai_generation", "video_ingestion", "video_ingest", "video_ingest_youtube", "video_ingest_url", "video_transcribe_to_document", "audio_ingestion", "audio_ingest", "document_indexing", "document_export", "document_convert", "legal_document_process", "tenant_cleanup", "test_job", "rag_index", "gdpr_delete"]>;
export type JobType = z.infer<typeof JobTypeSchema>;
export interface DispatchJobParams {
    tenantId: string;
    type: JobType;
    payload?: Record<string, any>;
}
export interface DispatchedJob {
    id: string;
    tenant_id: string;
    type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    payload: Record<string, any>;
    created_at: string;
}
/**
 * Dispatches a job to the job queue for asynchronous processing
 *
 * @param params - Job parameters including tenant ID, type, and payload
 * @returns The created job record
 * @throws Error if validation fails or database insert fails
 *
 * @example
 * ```typescript
 * const job = await dispatchJob({
 *   tenantId: '123e4567-e89b-12d3-a456-426614174000',
 *   type: 'ai_generation',
 *   payload: { prompt: 'Generate a summary', model: 'gpt-4' }
 * });
 * ```
 */
export declare const dispatchJob: (params: DispatchJobParams) => Promise<DispatchedJob>;
export {};
//# sourceMappingURL=dispatchJob.d.ts.map