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

import { supabaseAdmin } from '../lib/supabase';
import { completeJob } from '../utils/completeJob';
import { failJob } from '../utils/failJob';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const DocumentConvertPayloadSchema = z.object({
  storage_path: z.string().min(1),
  original_filename: z.string().min(1),
  file_size: z.number().int().positive(),
  mimetype: z.string().min(1),
  user_id: z.string().uuid(),
});

type DocumentConvertPayload = z.infer<typeof DocumentConvertPayloadSchema>;

interface Job {
  id: string;
  tenant_id: string;
  type: string;
  payload: DocumentConvertPayload;
  worker_id: string;
}

const CONVERSION_TIMEOUT_MS = 60000;

/**
 * Process a document conversion job
 * @param job - Job record from job_queue
 */
export async function processDocumentConvertJob(job: Job): Promise<void> {
  const workerId = job.worker_id;
  
  console.log(`[Worker ${workerId}] Processing document conversion job ${job.id}`);
  console.log(`[Worker ${workerId}] File: ${job.payload.original_filename}`);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Document conversion timeout after 60s')), CONVERSION_TIMEOUT_MS);
  });

  try {
    const conversionPromise = processConversion(job, workerId);
    await Promise.race([conversionPromise, timeoutPromise]);
  } catch (error) {
    console.error(`[Worker ${workerId}] Document conversion failed:`, error);
    await failJob({
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error during document conversion',
    });
  }
}

/**
 * Main conversion logic
 */
async function processConversion(job: Job, workerId: string): Promise<void> {
  const validated = DocumentConvertPayloadSchema.parse(job.payload);

  const tempFilePath = path.join(os.tmpdir(), `doc-${job.id}-${validated.original_filename}`);

  try {
    console.log(`[Worker ${workerId}] Downloading file from storage: ${validated.storage_path}`);
    
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('documents')
      .download(validated.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'No data'}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);

    console.log(`[Worker ${workerId}] Converting file to markdown...`);
    
    let markdownContent: string;
    let lineageEventType: string;

    if (validated.mimetype === 'application/pdf') {
      markdownContent = await convertPdfToMarkdown(buffer, workerId);
      lineageEventType = 'converted_from_pdf';
    } else if (
      validated.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      validated.mimetype === 'application/msword'
    ) {
      markdownContent = await convertDocxToMarkdown(tempFilePath, workerId);
      lineageEventType = 'converted_from_docx';
    } else if (validated.mimetype === 'text/markdown') {
      markdownContent = buffer.toString('utf-8');
      lineageEventType = 'converted_from_markdown';
    } else {
      throw new Error(`Unsupported file type: ${validated.mimetype}`);
    }

    const documentTitle = generateDocumentTitle(validated.original_filename);

    console.log(`[Worker ${workerId}] Creating document in database...`);
    
    const { data: document, error: docError } = await supabaseAdmin
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
    
    const { error: lineageError } = await supabaseAdmin
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
    
    const { error: usageError } = await supabaseAdmin
      .from('query_usage')
      .insert({
        tenant_id: job.tenant_id,
        user_id: validated.user_id,
        query_type: 'document_conversion',
        model_used: 'system',
        credits_used: 1,
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
    
    await completeJob({
      jobId: job.id,
      result: {
        document_id: document.id,
        title: document.title,
        content_length: markdownContent.length,
      },
    });

    console.log(`[Worker ${workerId}] Document conversion job completed successfully`);

  } finally {
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
async function convertPdfToMarkdown(buffer: Buffer, workerId: string): Promise<string> {
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
  } catch (error) {
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
async function convertDocxToMarkdown(filePath: string, workerId: string): Promise<string> {
  try {
    const result = await mammoth.convertToMarkdown({ path: filePath });
    
    if (result.messages.length > 0) {
      console.log(`[Worker ${workerId}] DOCX conversion warnings:`, result.messages);
    }
    
    const markdown = result.value.trim();
    
    console.log(`[Worker ${workerId}] DOCX converted: ${markdown.length} chars`);
    
    return markdown;
  } catch (error) {
    console.error(`[Worker ${workerId}] DOCX parsing error:`, error);
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate document title from filename
 * @param filename - Original filename
 * @returns Clean document title
 */
function generateDocumentTitle(filename: string): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  const cleaned = nameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
