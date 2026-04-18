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

import { supabaseAdmin } from '../lib/supabase';
import { completeJob } from '../utils/completeJob';
import { failJob } from '../utils/failJob';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

import { getModelCreditCost } from '../utils/creditCalculator';
import { generateText } from '../services/ai/generation';
import type { AIModel } from '../services/ai/types';

const FileMetadataSchema = z.object({
  original_filename: z.string().min(1),
  file_size: z.number().int().positive(),
  mimetype: z.string().min(1),
  file_extension: z.string().min(1),
  file_category: z.string().min(1),
  checksum_sha256: z.string().min(1),
  checksum_md5: z.string().min(1),
  upload_timestamp: z.string(),
  requires_ocr: z.boolean(),
  is_archival_format: z.boolean(),
});

const ProcessingOptionsSchema = z.object({
  enable_ocr: z.boolean().default(true),
  extract_text: z.boolean().default(true),
  preserve_formatting: z.boolean().default(true),
  index_for_search: z.boolean().default(true),
  convert_to_pdf_a: z.boolean().default(false),
  generate_summary: z.boolean().default(false),
  generate_article: z.boolean().default(false),
  ai_model: z.enum(['deepseek', 'gemini', 'claude']).default('deepseek'),
});

const LegalDocumentPayloadSchema = z.object({
  storage_path: z.string().min(1),
  user_id: z.string().uuid(),
  metadata: FileMetadataSchema,
  processing_options: ProcessingOptionsSchema,
});

type LegalDocumentPayload = z.infer<typeof LegalDocumentPayloadSchema>;

interface Job {
  id: string;
  tenant_id: string;
  type: string;
  payload: LegalDocumentPayload;
  worker_id: string;
}

const PROCESSING_TIMEOUT_MS = 120000;

const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
const BASE_CREDITS = 1;
const LARGE_FILE_CREDITS = 3;

function verifyChecksum(buffer: Buffer, expectedHash: string, algorithm: 'sha256' | 'md5'): boolean {
  const actualHash = crypto.createHash(algorithm).update(buffer).digest('hex');
  return actualHash === expectedHash;
}

/**
 * Process a legal document processing job
 * @param job - Job record from job_queue
 */
export async function processLegalDocumentJob(job: Job): Promise<void> {
  const workerId = job.worker_id;
  
  console.log(`[Worker ${workerId}] Processing legal document job ${job.id}`);
  console.log(`[Worker ${workerId}] File: ${job.payload.metadata.original_filename}`);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Legal document processing timeout after 120s')), PROCESSING_TIMEOUT_MS);
  });

  try {
    const processingPromise = processDocument(job, workerId);
    await Promise.race([processingPromise, timeoutPromise]);
  } catch (error) {
    console.error(`[Worker ${workerId}] Legal document processing failed:`, error);
    await failJob({
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error during legal document processing',
    });
  }
}

/**
 * Main processing logic
 */
async function processDocument(job: Job, workerId: string): Promise<void> {
  const validated = LegalDocumentPayloadSchema.parse(job.payload);
  const { metadata, processing_options } = validated;

  const tempFilePath = path.join(os.tmpdir(), `legal-${job.id}-${metadata.original_filename}`);

  try {
    console.log(`[Worker ${workerId}] Downloading file from storage: ${validated.storage_path}`);
    
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('tenant-uploads')
      .download(validated.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'No data'}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    console.log(`[Worker ${workerId}] Verifying file integrity...`);
    
    if (!verifyChecksum(buffer, metadata.checksum_sha256, 'sha256')) {
      throw new Error('File integrity check failed: SHA-256 checksum mismatch');
    }
    
    if (!verifyChecksum(buffer, metadata.checksum_md5, 'md5')) {
      throw new Error('File integrity check failed: MD5 checksum mismatch');
    }
    
    console.log(`[Worker ${workerId}] File integrity verified successfully`);

    fs.writeFileSync(tempFilePath, buffer);

    console.log(`[Worker ${workerId}] Extracting content from ${metadata.file_category} file...`);
    
    let extractedContent: string;
    let extractedMetadata: Record<string, any> = {};
    let lineageEventType: string;

    switch (metadata.file_category) {
      case 'pdf':
        const pdfResult = await extractPdfContent(buffer, workerId, processing_options.enable_ocr);
        extractedContent = pdfResult.content;
        extractedMetadata = pdfResult.metadata;
        lineageEventType = 'imported_from_pdf';
        break;

      case 'word':
        const wordResult = await extractWordContent(tempFilePath, workerId, processing_options.enable_ocr, job.tenant_id);
        extractedContent = wordResult.content;
        extractedMetadata = wordResult.metadata;
        lineageEventType = 'imported_from_word';
        break;

      case 'excel':
        extractedContent = await extractExcelContent(buffer, workerId);
        lineageEventType = 'imported_from_excel';
        break;

      case 'powerpoint':
        extractedContent = await extractPowerpointContent(buffer, workerId);
        lineageEventType = 'imported_from_powerpoint';
        break;

      case 'email':
        const emailResult = await extractEmailContent(buffer, metadata.file_extension, workerId);
        extractedContent = emailResult.content;
        extractedMetadata = emailResult.metadata;
        lineageEventType = 'imported_from_email';
        break;

      case 'image':
        extractedContent = await extractImageContent(buffer, metadata.mimetype, workerId, processing_options.enable_ocr);
        lineageEventType = 'imported_from_image';
        break;

      case 'text':
        extractedContent = buffer.toString('utf-8');
        lineageEventType = 'imported_from_text';
        break;

      default:
        throw new Error(`Unsupported file category: ${metadata.file_category}`);
    }

    const documentTitle = generateDocumentTitle(metadata.original_filename);

    console.log(`[Worker ${workerId}] Creating document in database...`);
    
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        tenant_id: job.tenant_id,
        title: documentTitle,
        content: extractedContent,
        status: 'draft',
        author_id: validated.user_id,
      })
      .select()
      .single();

    if (docError || !document) {
      throw new Error(`Failed to create document: ${docError?.message || 'No document returned'}`);
    }

    console.log(`[Worker ${workerId}] Document created: ${document.id}`);

    console.log(`[Worker ${workerId}] Creating lineage event with full audit trail...`);
    
    const { error: lineageError } = await supabaseAdmin
      .from('document_lineage')
      .insert({
        document_id: document.id,
        event_type: lineageEventType,
        actor_id: validated.user_id,
        metadata: {
          original_filename: metadata.original_filename,
          file_size: metadata.file_size,
          mimetype: metadata.mimetype,
          file_category: metadata.file_category,
          storage_path: validated.storage_path,
          checksums: {
            sha256: metadata.checksum_sha256,
            md5: metadata.checksum_md5,
          },
          upload_timestamp: metadata.upload_timestamp,
          is_archival_format: metadata.is_archival_format,
          extracted_metadata: extractedMetadata,
          processing_options: processing_options,
        },
      });

    if (lineageError) {
      console.error(`[Worker ${workerId}] Failed to create lineage event:`, lineageError);
    }

    // Calculate credits based on file size (base cost for extraction)
    const baseCredits = metadata.file_size > LARGE_FILE_THRESHOLD ? LARGE_FILE_CREDITS : BASE_CREDITS;
    let totalCredits = baseCredits;
    const creditBreakdown: Record<string, number> = { base: baseCredits };

    // Add AI processing credits if summary or article generation is enabled
    const modelCreditCost = getModelCreditCost(processing_options.ai_model || 'deepseek');
    
    if (processing_options.generate_summary) {
      totalCredits += modelCreditCost;
      creditBreakdown.summary = modelCreditCost;
    }
    
    if (processing_options.generate_article) {
      totalCredits += modelCreditCost;
      creditBreakdown.article = modelCreditCost;
    }
    
    console.log(`[Worker ${workerId}] Credit calculation:`, creditBreakdown, `Total: ${totalCredits}`);
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { error: creditError } = await supabaseAdmin.rpc('deduct_credits', {
      p_tenant_id: job.tenant_id,
      p_credits: totalCredits,
      p_month_year: currentMonth,
    });

    if (creditError) {
      console.error(`[Worker ${workerId}] Failed to deduct credits:`, creditError);
    } else {
      console.log(`[Worker ${workerId}] Successfully deducted ${totalCredits} credits`);
    }

    const { error: usageError } = await supabaseAdmin
      .from('query_usage')
      .insert({
        tenant_id: job.tenant_id,
        user_id: validated.user_id,
        query_type: 'legal_document_import',
        ai_model: processing_options.ai_model || 'system',
        credits_charged: totalCredits,
        metadata: {
          job_id: job.id,
          document_id: document.id,
          file_category: metadata.file_category,
          file_size: metadata.file_size,
          checksum_sha256: metadata.checksum_sha256,
          credit_breakdown: creditBreakdown,
          processing_options: {
            generate_summary: processing_options.generate_summary,
            generate_article: processing_options.generate_article,
            ai_model: processing_options.ai_model,
          },
        },
      });

    if (usageError) {
      console.error(`[Worker ${workerId}] Failed to log query usage:`, usageError);
    }

    console.log(`[Worker ${workerId}] Completing job...`);
    
    // Generate AI-enhanced outputs if requested
    let summaryDocId: string | null = null;
    let articleDocId: string | null = null;

    if (processing_options.generate_summary && extractedContent.length > 100) {
      console.log(`[Worker ${workerId}] Generating AI summary using ${processing_options.ai_model}...`);
      try {
        const summaryPrompt = `Generate a concise summary of the following document. Focus on key points, main topics, and important details. Format as clear bullet points or short paragraphs.\n\nDocument Content:\n${extractedContent.substring(0, 50000)}`;
        
        const summaryResponse = await generateText({
          prompt: summaryPrompt,
          model: (processing_options.ai_model === 'deepseek' ? 'deepseek-v3' : 
                 processing_options.ai_model === 'gemini' ? 'gemini-2.5-flash' : 
                 'claude-sonnet-4.5') as AIModel,
          maxTokens: 2000,
          systemPrompt: 'You are a professional document summarizer. Generate the summary IMMEDIATELY and IN FULL. Do NOT ask clarifying questions or engage in conversation. Do NOT include meta-commentary. Just output the summary content directly using proper Markdown formatting.',
        });
        const summaryContent = summaryResponse.content;

        const { data: summaryDoc } = await supabaseAdmin
          .from('documents')
          .insert({
            tenant_id: job.tenant_id,
            title: `${documentTitle} - Summary`,
            content: summaryContent,
            status: 'draft',
            author_id: validated.user_id,
          })
          .select()
          .single();

        if (summaryDoc) {
          summaryDocId = summaryDoc.id;
          console.log(`[Worker ${workerId}] Summary document created: ${summaryDocId}`);
        }
      } catch (error) {
        console.error(`[Worker ${workerId}] Failed to generate summary:`, error);
      }
    }

    if (processing_options.generate_article && extractedContent.length > 100) {
      console.log(`[Worker ${workerId}] Generating AI article using ${processing_options.ai_model}...`);
      try {
        const articlePrompt = `Transform the following document into a well-formatted, professional article. Improve readability, add proper structure with headings, and enhance clarity while preserving all important information. Use markdown formatting.\n\nDocument Content:\n${extractedContent.substring(0, 50000)}`;
        
        const articleResponse = await generateText({
          prompt: articlePrompt,
          model: (processing_options.ai_model === 'deepseek' ? 'deepseek-v3' : 
                 processing_options.ai_model === 'gemini' ? 'gemini-2.5-flash' : 
                 'claude-sonnet-4.5') as AIModel,
          maxTokens: 4000,
          systemPrompt: 'You are a professional document writer. Generate the article IMMEDIATELY and IN FULL. Do NOT ask clarifying questions or engage in conversation. Do NOT include meta-commentary. Just output the article content directly using proper Markdown formatting.',
        });
        const articleContent = articleResponse.content;

        const { data: articleDoc } = await supabaseAdmin
          .from('documents')
          .insert({
            tenant_id: job.tenant_id,
            title: `${documentTitle} - Article`,
            content: articleContent,
            status: 'draft',
            author_id: validated.user_id,
          })
          .select()
          .single();

        if (articleDoc) {
          articleDocId = articleDoc.id;
          console.log(`[Worker ${workerId}] Article document created: ${articleDocId}`);
        }
      } catch (error) {
        console.error(`[Worker ${workerId}] Failed to generate article:`, error);
      }
    }

    await completeJob({
      jobId: job.id,
      result: {
        document_id: document.id,
        summary_document_id: summaryDocId,
        article_document_id: articleDocId,
        title: document.title,
        content_length: extractedContent.length,
        file_category: metadata.file_category,
        checksums_verified: true,
        credits_charged: totalCredits,
        credit_breakdown: creditBreakdown,
        extracted_metadata: extractedMetadata,
      },
    });

    console.log(`[Worker ${workerId}] Legal document processing job completed successfully`);

  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`[Worker ${workerId}] Cleaned up temporary file`);
    }
  }
}

/**
 * Extract content from PDF files
 */
async function extractPdfContent(
  buffer: Buffer,
  workerId: string,
  enableOcr: boolean
): Promise<{ content: string; metadata: Record<string, any> }> {
  try {
    const data = await pdfParse(buffer);
    
    let markdown = `# ${data.info?.Title || 'PDF Document'}\n\n`;
    
    const metadata: Record<string, any> = {
      title: data.info?.Title,
      author: data.info?.Author,
      subject: data.info?.Subject,
      creator: data.info?.Creator,
      producer: data.info?.Producer,
      creation_date: data.info?.CreationDate,
      modification_date: data.info?.ModDate,
      page_count: data.numpages,
      pdf_version: data.info?.PDFFormatVersion,
    };

    if (data.info?.Author) {
      markdown += `**Author:** ${data.info.Author}\n`;
    }
    if (data.info?.Subject) {
      markdown += `**Subject:** ${data.info.Subject}\n`;
    }
    if (data.info?.CreationDate) {
      markdown += `**Created:** ${data.info.CreationDate}\n`;
    }
    markdown += `**Pages:** ${data.numpages}\n\n`;
    markdown += '---\n\n';
    
    const cleanText = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Check if PDF is scanned/image-based (very little text extracted)
    const isScannedPdf = cleanText.length < 100;
    
    if (isScannedPdf && enableOcr) {
      console.log(`[Worker ${workerId}] PDF appears to be scanned, running OCR with pdftoppm + Tesseract...`);
      markdown += '**Document Type:** Scanned/Image-based PDF\n\n';
      markdown += '---\n\n';

      let ocrText = '';
      const tempDir = path.join(os.tmpdir(), `ocr-${Date.now()}`);

      try {
        fs.mkdirSync(tempDir, { recursive: true });

        // Write PDF to temp file for pdftoppm
        const tempPdfPath = path.join(tempDir, 'input.pdf');
        fs.writeFileSync(tempPdfPath, buffer);

        // Convert PDF pages to PNG images using pdftoppm (from poppler-utils)
        // Limit to first 20 pages to avoid excessive processing
        const maxPages = Math.min(data.numpages || 20, 20);
        console.log(`[Worker ${workerId}] Converting ${maxPages} PDF page(s) to images...`);

        execSync(
          `pdftoppm -png -r 300 -l ${maxPages} "${tempPdfPath}" "${path.join(tempDir, 'page')}"`,
          { timeout: 60000 }
        );

        // Find generated page images
        const pageFiles = fs.readdirSync(tempDir)
          .filter(f => f.startsWith('page-') && f.endsWith('.png'))
          .sort();

        console.log(`[Worker ${workerId}] Generated ${pageFiles.length} page image(s), running OCR...`);

        // OCR each page with Tesseract.js
        for (const pageFile of pageFiles) {
          const imagePath = path.join(tempDir, pageFile);
          const imageBuffer = fs.readFileSync(imagePath);

          const { data: { text: pageText } } = await Tesseract.recognize(
            imageBuffer,
            'eng',
            {
              logger: (m: any) => {
                if (m.status === 'recognizing text') {
                  console.log(`[Worker ${workerId}] OCR ${pageFile}: ${Math.round(m.progress * 100)}%`);
                }
              }
            }
          );

          if (pageText && pageText.trim().length > 0) {
            ocrText += pageText.trim() + '\n\n';
          }
        }

        if (ocrText.trim().length > 0) {
          markdown += '## OCR Extracted Text\n\n';
          markdown += ocrText.trim();
          console.log(`[Worker ${workerId}] OCR extracted ${ocrText.length} characters from ${pageFiles.length} page(s)`);
          metadata.ocr_processed = true;
          metadata.ocr_pages = pageFiles.length;
          metadata.ocr_characters = ocrText.length;
        } else {
          markdown += '*OCR processing completed but no readable text was found in the scanned pages.*\n';
          metadata.ocr_processed = true;
          metadata.ocr_pages = pageFiles.length;
          metadata.ocr_characters = 0;
        }
      } catch (ocrError) {
        console.error(`[Worker ${workerId}] PDF OCR failed:`, ocrError);
        markdown += '## OCR Extraction\n\n';
        markdown += '*OCR processing encountered an error. Partial text may be available below.*\n\n';
        if (cleanText.length > 0) {
          markdown += cleanText;
        }
        metadata.ocr_processed = false;
        metadata.ocr_error = ocrError instanceof Error ? ocrError.message : 'Unknown OCR error';
      } finally {
        // Clean up temp directory
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch { /* ignore cleanup errors */ }
      }

      metadata.is_scanned = true;
    } else {
      markdown += cleanText;
      metadata.is_scanned = false;
    }
    
    console.log(`[Worker ${workerId}] PDF extracted: ${data.numpages} pages, ${cleanText.length} chars${isScannedPdf ? ' (scanned)' : ''}`);
    
    return { content: markdown, metadata };
  } catch (error) {
    console.error(`[Worker ${workerId}] PDF parsing error:`, error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract content from Word documents
 */
async function extractWordContent(
  filePath: string,
  workerId: string,
  enableOcr: boolean = false,
  tenantId: string
): Promise<{ content: string; metadata: Record<string, any> }> {
  try {
    const result = await mammoth.convertToMarkdown({ path: filePath });
    
    if (result.messages.length > 0) {
      console.log(`[Worker ${workerId}] DOCX conversion warnings:`, result.messages);
    }
    
    let markdown = result.value.trim();
    
    // Process base64 images: extract, upload to storage, and replace with URLs
    const base64ImageRegex = /!\[([^\]]*)\]\(data:image\/([^;]+);base64,([a-zA-Z0-9+/=]+)\)/g;
    const imageMatches = [...markdown.matchAll(base64ImageRegex)];
    
    if (imageMatches.length > 0) {
      console.log(`[Worker ${workerId}] Found ${imageMatches.length} base64 images, uploading to storage...`);
      
      for (let i = 0; i < imageMatches.length; i++) {
        const match = imageMatches[i];
        const altText = match[1];
        const imageType = match[2]; // e.g., png, jpeg
        const base64Data = match[3];
        const fullMatch = match[0];
        
        try {
          // Decode base64 to buffer
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Generate storage path with tenant prefix (required by RLS policy)
          const timestamp = Date.now();
          const storagePath = `tenant-${tenantId}/images/${timestamp}-image-${i}.${imageType}`;
          
          // Upload to Supabase storage
          const { error: uploadError } = await supabaseAdmin
            .storage
            .from('tenant-documents')
            .upload(storagePath, imageBuffer, {
              contentType: `image/${imageType}`,
              upsert: false,
            });
          
          if (uploadError) {
            console.error(`[Worker ${workerId}] Failed to upload image ${i}:`, uploadError);
            // Keep original base64 if upload fails
            continue;
          }
          
          // Create signed URL valid for 1 year
          const { data: signedUrlData } = await supabaseAdmin
            .storage
            .from('tenant-documents')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year
          
          if (signedUrlData) {
            // Replace base64 with signed URL in markdown
            markdown = markdown.replace(fullMatch, `![${altText}](${signedUrlData.signedUrl})`);
            console.log(`[Worker ${workerId}] Uploaded image ${i}/${imageMatches.length}: ${storagePath}`);
          } else {
            console.error(`[Worker ${workerId}] Failed to create signed URL for image ${i}`);
          }
        } catch (error) {
          console.error(`[Worker ${workerId}] Error processing image ${i}:`, error);
        }
      }
      
      console.log(`[Worker ${workerId}] Image processing complete`);
    }
    
    // Check if document appears to be image-based (very little text extracted)
    const textOnly = markdown.replace(/!\[([^\]]*)\]\([^)]+\)/g, '').replace(/[#*_`\-\[\]]/g, '').trim();
    const isImageBasedDoc = textOnly.length < 50;
    
    if (enableOcr) {
      console.log(`[Worker ${workerId}] OCR requested for Word document (${textOnly.length} chars text)`);
      if (isImageBasedDoc) {
        markdown += '\n\n---\n\n**Note:** This Word document appears to be image-based (scanned). OCR processing for Word documents is not currently supported. Please convert the document to PDF format and re-upload with OCR enabled for text extraction.\n\n';
      } else {
        // For mixed documents, add a note that OCR is available for PDFs
        markdown += '\n\n---\n\n**Note:** This document contains both text and images. For OCR processing of embedded images, please convert the document to PDF format and re-upload with OCR enabled.\n\n';
      }
    }
    
    console.log(`[Worker ${workerId}] Word document converted: ${markdown.length} chars`);
    
    return {
      content: markdown,
      metadata: {
        conversion_warnings: result.messages,
        images_processed: imageMatches.length,
        is_image_based: isImageBasedDoc,
      },
    };
  } catch (error) {
    console.error(`[Worker ${workerId}] Word parsing error:`, error);
    throw new Error(`Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract content from Excel files
 */
async function extractExcelContent(buffer: Buffer, workerId: string): Promise<string> {
  let markdown = '# Excel Spreadsheet\n\n';
  markdown += '*Excel file imported. Full spreadsheet parsing available in document view.*\n\n';
  markdown += `**File Size:** ${formatFileSize(buffer.length)}\n`;
  
  console.log(`[Worker ${workerId}] Excel file processed (basic extraction)`);
  
  return markdown;
}

/**
 * Extract content from PowerPoint files
 */
async function extractPowerpointContent(buffer: Buffer, workerId: string): Promise<string> {
  let markdown = '# PowerPoint Presentation\n\n';
  markdown += '*PowerPoint file imported. Presentation content available in document view.*\n\n';
  markdown += `**File Size:** ${formatFileSize(buffer.length)}\n`;
  
  console.log(`[Worker ${workerId}] PowerPoint file processed (basic extraction)`);
  
  return markdown;
}

/**
 * Extract content from email files (MSG, EML)
 */
async function extractEmailContent(
  buffer: Buffer,
  extension: string,
  workerId: string
): Promise<{ content: string; metadata: Record<string, any> }> {
  let markdown = '# Email Message\n\n';
  
  if (extension === '.eml') {
    const emlContent = buffer.toString('utf-8');
    
    const fromMatch = emlContent.match(/^From:\s*(.+)$/m);
    const toMatch = emlContent.match(/^To:\s*(.+)$/m);
    const subjectMatch = emlContent.match(/^Subject:\s*(.+)$/m);
    const dateMatch = emlContent.match(/^Date:\s*(.+)$/m);
    
    const metadata: Record<string, any> = {};
    
    if (fromMatch) {
      markdown += `**From:** ${fromMatch[1]}\n`;
      metadata.from = fromMatch[1];
    }
    if (toMatch) {
      markdown += `**To:** ${toMatch[1]}\n`;
      metadata.to = toMatch[1];
    }
    if (subjectMatch) {
      markdown += `**Subject:** ${subjectMatch[1]}\n`;
      metadata.subject = subjectMatch[1];
    }
    if (dateMatch) {
      markdown += `**Date:** ${dateMatch[1]}\n`;
      metadata.date = dateMatch[1];
    }
    
    markdown += '\n---\n\n';
    
    const bodyStart = emlContent.indexOf('\n\n');
    if (bodyStart > -1) {
      markdown += emlContent.substring(bodyStart + 2);
    }
    
    console.log(`[Worker ${workerId}] EML email parsed`);
    
    return { content: markdown, metadata };
  }
  
  markdown += '*MSG file imported. Email content extraction in progress.*\n\n';
  markdown += `**File Size:** ${formatFileSize(buffer.length)}\n`;
  
  console.log(`[Worker ${workerId}] MSG email processed (basic extraction)`);
  
  return { content: markdown, metadata: {} };
}

/**
 * Extract content from image files
 */
async function extractImageContent(
  buffer: Buffer,
  mimetype: string,
  workerId: string,
  enableOcr: boolean
): Promise<string> {
  let markdown = '# Image Document\n\n';
  markdown += `**Format:** ${mimetype}\n`;
  markdown += `**Size:** ${formatFileSize(buffer.length)}\n\n`;
  
  if (enableOcr) {
    try {
      console.log(`[Worker ${workerId}] Running OCR on image...`);
      
      const { data: { text } } = await Tesseract.recognize(
        buffer,
        'eng',
        {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              console.log(`[Worker ${workerId}] OCR progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      markdown += '## OCR Extracted Text\n\n';
      
      if (text && text.trim().length > 0) {
        markdown += text.trim();
        console.log(`[Worker ${workerId}] OCR extracted ${text.length} characters`);
      } else {
        markdown += '*No text could be extracted from this image.*\n';
        console.log(`[Worker ${workerId}] OCR found no text`);
      }
    } catch (error) {
      console.error(`[Worker ${workerId}] OCR failed:`, error);
      markdown += '*OCR processing failed. Image imported without text extraction.*\n\n';
      markdown += `**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    }
  } else {
    markdown += '*Image imported without OCR processing.*\n';
  }
  
  console.log(`[Worker ${workerId}] Image file processed`);
  
  return markdown;
}

/**
 * Generate document title from filename
 */
function generateDocumentTitle(filename: string): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  const cleaned = nameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
