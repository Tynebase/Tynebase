/**
 * Video Ingestion Worker
 * Processes video_ingest jobs from the job queue
 *
 * Workflow:
 * 1. Download audio via sidecar (YouTube) or get signed URL (upload) or download (direct URL)
 * 2. Upload to GCS
 * 3. Transcribe with Gemini 2.5 Flash
 * 4. Generate summary/article with selected AI model
 * 5. Create document(s)
 * 6. Create lineage event (type: converted_from_video)
 * 7. Log query_usage with credits
 * 8. Delete video from storage (optional config)
 * 9. Mark job as completed with document_id
 */
import { z } from 'zod';
declare const VideoIngestPayloadSchema: z.ZodEffects<z.ZodObject<{
    storage_path: z.ZodOptional<z.ZodString>;
    original_filename: z.ZodOptional<z.ZodString>;
    file_size: z.ZodOptional<z.ZodNumber>;
    mimetype: z.ZodOptional<z.ZodString>;
    user_id: z.ZodString;
    youtube_url: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
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
    url?: string | undefined;
    youtube_url?: string | undefined;
    storage_path?: string | undefined;
    mimetype?: string | undefined;
    original_filename?: string | undefined;
    file_size?: number | undefined;
    output_options?: {
        generate_transcript: boolean;
        generate_summary: boolean;
        generate_article: boolean;
        ai_model: "deepseek" | "gemini" | "claude";
    } | undefined;
}, {
    user_id: string;
    url?: string | undefined;
    youtube_url?: string | undefined;
    storage_path?: string | undefined;
    mimetype?: string | undefined;
    original_filename?: string | undefined;
    file_size?: number | undefined;
    output_options?: {
        generate_transcript?: boolean | undefined;
        generate_summary?: boolean | undefined;
        generate_article?: boolean | undefined;
        ai_model?: "deepseek" | "gemini" | "claude" | undefined;
    } | undefined;
}>, {
    user_id: string;
    url?: string | undefined;
    youtube_url?: string | undefined;
    storage_path?: string | undefined;
    mimetype?: string | undefined;
    original_filename?: string | undefined;
    file_size?: number | undefined;
    output_options?: {
        generate_transcript: boolean;
        generate_summary: boolean;
        generate_article: boolean;
        ai_model: "deepseek" | "gemini" | "claude";
    } | undefined;
}, {
    user_id: string;
    url?: string | undefined;
    youtube_url?: string | undefined;
    storage_path?: string | undefined;
    mimetype?: string | undefined;
    original_filename?: string | undefined;
    file_size?: number | undefined;
    output_options?: {
        generate_transcript?: boolean | undefined;
        generate_summary?: boolean | undefined;
        generate_article?: boolean | undefined;
        ai_model?: "deepseek" | "gemini" | "claude" | undefined;
    } | undefined;
}>;
type VideoIngestPayload = z.infer<typeof VideoIngestPayloadSchema>;
interface Job {
    id: string;
    tenant_id: string;
    type: string;
    payload: VideoIngestPayload;
    worker_id: string;
}
/**
 * Process a video ingestion job
 * @param job - Job record from job_queue
 * @returns Job result with document IDs and metadata
 */
export declare function processVideoIngestJob(job: Job): Promise<Record<string, any>>;
export {};
//# sourceMappingURL=videoIngest.d.ts.map