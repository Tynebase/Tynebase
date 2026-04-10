/**
 * Legal Document Processing Worker
 * Processes legal_document_process jobs from the job queue
 *
 * Workflow:
 * 1. Download file from Supabase Storage
 * 2. Verify checksums (SHA-256, MD5)
 * 3. Extract text based on file type (OCR for images/scanned PDFs)
 * 4. Preserve metadata (creation date, author, digital signatures)
 * 5. Create document with extracted content
 * 6. Index for full-text search
 * 7. Create lineage event with full audit trail
 * 8. Deduct credits based on file type/size
 */
import { z } from 'zod';
declare const LegalDocumentPayloadSchema: z.ZodObject<{
    storage_path: z.ZodString;
    user_id: z.ZodString;
    metadata: z.ZodObject<{
        original_filename: z.ZodString;
        file_size: z.ZodNumber;
        mimetype: z.ZodString;
        file_extension: z.ZodString;
        file_category: z.ZodString;
        checksum_sha256: z.ZodString;
        checksum_md5: z.ZodString;
        upload_timestamp: z.ZodString;
        requires_ocr: z.ZodBoolean;
        is_archival_format: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        mimetype: string;
        original_filename: string;
        file_size: number;
        file_extension: string;
        file_category: string;
        checksum_sha256: string;
        checksum_md5: string;
        upload_timestamp: string;
        requires_ocr: boolean;
        is_archival_format: boolean;
    }, {
        mimetype: string;
        original_filename: string;
        file_size: number;
        file_extension: string;
        file_category: string;
        checksum_sha256: string;
        checksum_md5: string;
        upload_timestamp: string;
        requires_ocr: boolean;
        is_archival_format: boolean;
    }>;
    processing_options: z.ZodObject<{
        enable_ocr: z.ZodDefault<z.ZodBoolean>;
        extract_text: z.ZodDefault<z.ZodBoolean>;
        preserve_formatting: z.ZodDefault<z.ZodBoolean>;
        index_for_search: z.ZodDefault<z.ZodBoolean>;
        convert_to_pdf_a: z.ZodDefault<z.ZodBoolean>;
        generate_summary: z.ZodDefault<z.ZodBoolean>;
        generate_article: z.ZodDefault<z.ZodBoolean>;
        ai_model: z.ZodDefault<z.ZodEnum<["deepseek", "gemini", "claude"]>>;
    }, "strip", z.ZodTypeAny, {
        generate_summary: boolean;
        generate_article: boolean;
        ai_model: "deepseek" | "gemini" | "claude";
        enable_ocr: boolean;
        extract_text: boolean;
        preserve_formatting: boolean;
        index_for_search: boolean;
        convert_to_pdf_a: boolean;
    }, {
        generate_summary?: boolean | undefined;
        generate_article?: boolean | undefined;
        ai_model?: "deepseek" | "gemini" | "claude" | undefined;
        enable_ocr?: boolean | undefined;
        extract_text?: boolean | undefined;
        preserve_formatting?: boolean | undefined;
        index_for_search?: boolean | undefined;
        convert_to_pdf_a?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    metadata: {
        mimetype: string;
        original_filename: string;
        file_size: number;
        file_extension: string;
        file_category: string;
        checksum_sha256: string;
        checksum_md5: string;
        upload_timestamp: string;
        requires_ocr: boolean;
        is_archival_format: boolean;
    };
    storage_path: string;
    processing_options: {
        generate_summary: boolean;
        generate_article: boolean;
        ai_model: "deepseek" | "gemini" | "claude";
        enable_ocr: boolean;
        extract_text: boolean;
        preserve_formatting: boolean;
        index_for_search: boolean;
        convert_to_pdf_a: boolean;
    };
}, {
    user_id: string;
    metadata: {
        mimetype: string;
        original_filename: string;
        file_size: number;
        file_extension: string;
        file_category: string;
        checksum_sha256: string;
        checksum_md5: string;
        upload_timestamp: string;
        requires_ocr: boolean;
        is_archival_format: boolean;
    };
    storage_path: string;
    processing_options: {
        generate_summary?: boolean | undefined;
        generate_article?: boolean | undefined;
        ai_model?: "deepseek" | "gemini" | "claude" | undefined;
        enable_ocr?: boolean | undefined;
        extract_text?: boolean | undefined;
        preserve_formatting?: boolean | undefined;
        index_for_search?: boolean | undefined;
        convert_to_pdf_a?: boolean | undefined;
    };
}>;
type LegalDocumentPayload = z.infer<typeof LegalDocumentPayloadSchema>;
interface Job {
    id: string;
    tenant_id: string;
    type: string;
    payload: LegalDocumentPayload;
    worker_id: string;
}
/**
 * Process a legal document processing job
 * @param job - Job record from job_queue
 */
export declare function processLegalDocumentJob(job: Job): Promise<void>;
export {};
//# sourceMappingURL=legalDocumentProcess.d.ts.map