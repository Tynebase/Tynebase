/**
 * Audio Ingestion Worker
 * Processes audio_ingestion jobs from the job queue
 *
 * Workflow:
 * 1. Get audio from GCS URI
 * 2. Transcribe using Gemini 2.5 Flash
 * 3. Calculate credits based on pipeline
 * 4. Create document(s) with transcript/summary/article
 * 5. Create lineage event
 * 6. Log query_usage with credits
 * 7. Delete audio from GCS
 * 8. Mark job as completed with document_id
 */
import { z } from 'zod';
declare const AudioIngestPayloadSchema: z.ZodObject<{
    gcs_uri: z.ZodString;
    original_filename: z.ZodString;
    file_size: z.ZodNumber;
    mimetype: z.ZodString;
    user_id: z.ZodString;
    output_options: z.ZodOptional<z.ZodObject<{
        generate_transcript: z.ZodDefault<z.ZodBoolean>;
        generate_summary: z.ZodDefault<z.ZodBoolean>;
        generate_article: z.ZodDefault<z.ZodBoolean>;
        ai_model: z.ZodDefault<z.ZodEnum<["deepseek", "gemini", "claude"]>>;
    }, "strip", z.ZodTypeAny, {
        generate_transcript: boolean;
        generate_summary: boolean;
        generate_article: boolean;
        ai_model: "deepseek" | "gemini" | "claude";
    }, {
        generate_transcript?: boolean | undefined;
        generate_summary?: boolean | undefined;
        generate_article?: boolean | undefined;
        ai_model?: "deepseek" | "gemini" | "claude" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    mimetype: string;
    original_filename: string;
    file_size: number;
    gcs_uri: string;
    output_options?: {
        generate_transcript: boolean;
        generate_summary: boolean;
        generate_article: boolean;
        ai_model: "deepseek" | "gemini" | "claude";
    } | undefined;
}, {
    user_id: string;
    mimetype: string;
    original_filename: string;
    file_size: number;
    gcs_uri: string;
    output_options?: {
        generate_transcript?: boolean | undefined;
        generate_summary?: boolean | undefined;
        generate_article?: boolean | undefined;
        ai_model?: "deepseek" | "gemini" | "claude" | undefined;
    } | undefined;
}>;
type AudioIngestPayload = z.infer<typeof AudioIngestPayloadSchema>;
interface Job {
    id: string;
    tenant_id: string;
    type: string;
    payload: AudioIngestPayload;
    worker_id: string;
}
/**
 * Process an audio ingestion job
 * @param job - Job record from job_queue
 * @returns Job result with document IDs and metadata
 */
export declare function processAudioIngestJob(job: Job): Promise<Record<string, any>>;
export {};
//# sourceMappingURL=audioIngest.d.ts.map