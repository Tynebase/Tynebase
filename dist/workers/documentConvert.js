"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocumentConvertJob = processDocumentConvertJob;
const supabase_1 = require("../lib/supabase");
const completeJob_1 = require("../utils/completeJob");
const failJob_1 = require("../utils/failJob");
const zod_1 = require("zod");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const DocumentConvertPayloadSchema = zod_1.z.object({
    storage_path: zod_1.z.string().min(1),
    original_filename: zod_1.z.string().min(1),
    file_size: zod_1.z.number().int().positive(),
    mimetype: zod_1.z.string().min(1),
    user_id: zod_1.z.string().uuid(),
});
const CONVERSION_TIMEOUT_MS = 60000;
/**
 * Process a document conversion job
 * @param job - Job record from job_queue
 */
async function processDocumentConvertJob(job) {
    const workerId = job.worker_id;
    console.log(`[Worker ${workerId}] Processing document conversion job ${job.id}`);
    console.log(`[Worker ${workerId}] File: ${job.payload.original_filename}`);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Document conversion timeout after 60s')), CONVERSION_TIMEOUT_MS);
    });
    try {
        const conversionPromise = processConversion(job, workerId);
        await Promise.race([conversionPromise, timeoutPromise]);
    }
    catch (error) {
        console.error(`[Worker ${workerId}] Document conversion failed:`, error);
        await (0, failJob_1.failJob)({
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error during document conversion',
        });
    }
}
/**
 * Main conversion logic
 */
async function processConversion(job, workerId) {
    const validated = DocumentConvertPayloadSchema.parse(job.payload);
    const tempFilePath = path.join(os.tmpdir(), `doc-${job.id}-${validated.original_filename}`);
    try {
        console.log(`[Worker ${workerId}] Downloading file from storage: ${validated.storage_path}`);
        const { data: fileData, error: downloadError } = await supabase_1.supabaseAdmin
            .storage
            .from('tenant-uploads')
            .download(validated.storage_path);
        if (downloadError || !fileData) {
            throw new Error(`Failed to download file: ${downloadError?.message || 'No data'}`);
        }
        const buffer = Buffer.from(await fileData.arrayBuffer());
        fs.writeFileSync(tempFilePath, buffer);
        console.log(`[Worker ${workerId}] Converting file to markdown...`);
        let markdownContent;
        let lineageEventType;
        // Determine file type from extension if mimetype is generic
        const fileExtension = validated.original_filename.substring(validated.original_filename.lastIndexOf('.')).toLowerCase();
        const isMarkdownFile = fileExtension === '.md' || fileExtension === '.markdown';
        const isTextFile = fileExtension === '.txt';
        if (validated.mimetype === 'application/pdf') {
            markdownContent = await convertPdfToMarkdown(buffer, workerId);
            lineageEventType = 'converted_from_pdf';
        }
        else if (validated.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            validated.mimetype === 'application/msword') {
            markdownContent = await convertDocxToMarkdown(tempFilePath, workerId);
            lineageEventType = 'converted_from_docx';
        }
        else if (validated.mimetype === 'text/markdown' ||
            validated.mimetype === 'text/x-markdown' ||
            isMarkdownFile) {
            markdownContent = buffer.toString('utf-8');
            lineageEventType = 'imported_from_markdown';
        }
        else if (validated.mimetype === 'text/plain' || isTextFile) {
            markdownContent = buffer.toString('utf-8');
            lineageEventType = 'imported_from_text';
        }
        else {
            throw new Error(`Unsupported file type: ${validated.mimetype}`);
        }
        const documentTitle = generateDocumentTitle(validated.original_filename);
        console.log(`[Worker ${workerId}] Creating document in database...`);
        const { data: document, error: docError } = await supabase_1.supabaseAdmin
            .from('documents')
            .insert({
            tenant_id: job.tenant_id,
            title: documentTitle,
            content: markdownContent,
            status: 'draft',
            author_id: validated.user_id,
        })
            .select()
            .single();
        if (docError || !document) {
            throw new Error(`Failed to create document: ${docError?.message || 'No document returned'}`);
        }
        console.log(`[Worker ${workerId}] Document created: ${document.id}`);
        console.log(`[Worker ${workerId}] Creating lineage event...`);
        const { error: lineageError } = await supabase_1.supabaseAdmin
            .from('document_lineage')
            .insert({
            document_id: document.id,
            event_type: lineageEventType,
            actor_id: validated.user_id,
            metadata: {
                original_filename: validated.original_filename,
                file_size: validated.file_size,
                mimetype: validated.mimetype,
                storage_path: validated.storage_path,
            },
        });
        if (lineageError) {
            console.error(`[Worker ${workerId}] Failed to create lineage event:`, lineageError);
        }
        console.log(`[Worker ${workerId}] Logging credit usage...`);
        const { error: usageError } = await supabase_1.supabaseAdmin
            .from('query_usage')
            .insert({
            tenant_id: job.tenant_id,
            user_id: validated.user_id,
            query_type: 'document_conversion',
            ai_model: 'system',
            credits_charged: 1,
            metadata: {
                job_id: job.id,
                document_id: document.id,
                file_type: validated.mimetype,
                file_size: validated.file_size,
            },
        });
        if (usageError) {
            console.error(`[Worker ${workerId}] Failed to log query usage:`, usageError);
        }
        console.log(`[Worker ${workerId}] Completing job...`);
        await (0, completeJob_1.completeJob)({
            jobId: job.id,
            result: {
                document_id: document.id,
                title: document.title,
                content_length: markdownContent.length,
            },
        });
        console.log(`[Worker ${workerId}] Document conversion job completed successfully`);
    }
    finally {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`[Worker ${workerId}] Cleaned up temporary file`);
        }
    }
}
/**
 * Convert PDF to Markdown
 * @param buffer - PDF file buffer
 * @param workerId - Worker ID for logging
 * @returns Markdown content
 */
async function convertPdfToMarkdown(buffer, workerId) {
    try {
        const data = await pdfParse(buffer);
        let markdown = `# ${data.info?.Title || 'Converted Document'}\n\n`;
        if (data.info?.Author) {
            markdown += `**Author:** ${data.info.Author}\n\n`;
        }
        if (data.info?.Subject) {
            markdown += `**Subject:** ${data.info.Subject}\n\n`;
        }
        markdown += '---\n\n';
        const cleanText = data.text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        markdown += cleanText;
        console.log(`[Worker ${workerId}] PDF converted: ${data.numpages} pages, ${data.text.length} chars`);
        return markdown;
    }
    catch (error) {
        console.error(`[Worker ${workerId}] PDF parsing error:`, error);
        throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Convert DOCX to Markdown
 * @param filePath - Path to DOCX file
 * @param workerId - Worker ID for logging
 * @returns Markdown content
 */
async function convertDocxToMarkdown(filePath, workerId) {
    try {
        const result = await mammoth.convertToMarkdown({ path: filePath });
        if (result.messages.length > 0) {
            console.log(`[Worker ${workerId}] DOCX conversion warnings:`, result.messages);
        }
        const markdown = result.value.trim();
        console.log(`[Worker ${workerId}] DOCX converted: ${markdown.length} chars`);
        return markdown;
    }
    catch (error) {
        console.error(`[Worker ${workerId}] DOCX parsing error:`, error);
        throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Generate document title from filename
 * @param filename - Original filename
 * @returns Clean document title
 */
function generateDocumentTitle(filename) {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const cleaned = nameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
//# sourceMappingURL=documentConvert.js.map