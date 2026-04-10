/**
 * RAG Index Worker
 * Processes rag_index jobs from the job queue
 *
 * Workflow:
 * 1. Get document content from database
 * 2. Run 4-pass semantic chunking algorithm
 * 3. Batch chunks (max 96 per API call for Cohere)
 * 4. Call Cohere Embed v4.0 via AWS Bedrock
 * 5. Insert embeddings into document_embeddings table
 * 6. Update documents.last_indexed_at timestamp
 * 7. Mark job as completed
 */
import { z } from 'zod';
declare const RagIndexPayloadSchema: z.ZodObject<{
    document_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    document_id: string;
}, {
    document_id: string;
}>;
type RagIndexPayload = z.infer<typeof RagIndexPayloadSchema>;
interface Job {
    id: string;
    tenant_id: string;
    type: string;
    payload: RagIndexPayload;
    worker_id: string;
}
/**
 * Process a RAG index job
 * @param job - Job record from job_queue
 */
export declare function processRagIndexJob(job: Job): Promise<void>;
export {};
//# sourceMappingURL=ragIndex.d.ts.map