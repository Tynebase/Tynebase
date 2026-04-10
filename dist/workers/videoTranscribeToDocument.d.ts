/**
 * Video Transcribe to Document Worker
 * Processes video_transcribe_to_document jobs from the job queue
 *
 * Flow:
 * 1. Download video via sidecar (YouTube) or get from Supabase Storage (uploaded)
 * 2. Upload to GCS
 * 3. Transcribe with Gemini 2.5 Flash
 * 4. Generate summary/article with selected AI model
 * 5. Format as Markdown
 * 6. Append to document content
 * 7. Charge credits
 * 8. Log query_usage
 */
interface Job {
    id: string;
    tenant_id: string;
    type: string;
    status: string;
    payload: Record<string, any>;
    worker_id: string;
    attempts: number;
    created_at: string;
}
/**
 * Process a video transcribe to document job
 * @param job - Job record from job_queue
 * @returns Job result with transcript metadata
 */
export declare function processVideoTranscribeToDocumentJob(job: Job): Promise<Record<string, any>>;
export {};
//# sourceMappingURL=videoTranscribeToDocument.d.ts.map