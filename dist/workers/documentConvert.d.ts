/**
 * Document Conversion Worker
 * Processes document_convert jobs from the job queue
 *
 * Workflow:
 * 1. Download file from Supabase Storage
 * 2. Convert to Markdown (pdf-parse for PDF, mammoth for DOCX)
 * 3. Create document with markdown content
 * 4. Create lineage event (type: converted_from_pdf/docx)
 * 5. Deduct 1 credit
 * 6. Mark job as completed with document_id
 */
import { z } from 'zod';
declare const DocumentConvertPayloadSchema: z.ZodObject<{
    storage_path: z.ZodString;
    original_filename: z.ZodString;
    file_size: z.ZodNumber;
    mimetype: z.ZodString;
    user_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    storage_path: string;
    mimetype: string;
    original_filename: string;
    file_size: number;
}, {
    user_id: string;
    storage_path: string;
    mimetype: string;
    original_filename: string;
    file_size: number;
}>;
type DocumentConvertPayload = z.infer<typeof DocumentConvertPayloadSchema>;
interface Job {
    id: string;
    tenant_id: string;
    type: string;
    payload: DocumentConvertPayload;
    worker_id: string;
}
/**
 * Process a document conversion job
 * @param job - Job record from job_queue
 */
export declare function processDocumentConvertJob(job: Job): Promise<void>;
export {};
//# sourceMappingURL=documentConvert.d.ts.map