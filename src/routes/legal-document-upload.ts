import { FastifyInstance } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { dispatchJob } from '../utils/dispatchJob';
import * as crypto from 'crypto';

/**
 * Legal Document Upload - Supported File Types
 * 
 * 1. Mandatory Archival & Legal Standards (Must Have)
 *    - PDF/A (application/pdf) - Gold standard for long-term storage
 *    - TIFF (image/tiff) - For scanned documents, handwritten notes
 *    - OCR-Enhanced PDFs - Processed automatically
 * 
 * 2. Active Legal & Operational Files (High Priority)
 *    - DOCX/DOC (Microsoft Word) - Working documents, contracts
 *    - PDF (Standard) - Final non-editable versions
 *    - MSG/EML (Email Files) - Client communications
 *    - XLSX/XLS (Excel) - Financial documents
 *    - PPTX/PPT (PowerPoint) - Presentations, evidence
 * 
 * 3. Supporting & Multimedia Evidence
 *    - Images: PNG, JPEG, GIF
 *    - Plain Text (.txt)
 *    - Audio/Video: MP3, WAV, MP4, MOV
 */

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  // PDF files (including PDF/A)
  pdf: ['application/pdf'],
  
  // Microsoft Office Documents
  word: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
  excel: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  powerpoint: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
  ],
  
  // Email files
  email: [
    'message/rfc822',
    'application/vnd.ms-outlook',
  ],
  
  // Images
  image: [
    'image/tiff',
    'image/png',
    'image/jpeg',
    'image/gif',
  ],
  
  // Plain text and markdown
  text: [
    'text/plain',
    'text/markdown',
  ],
  
};

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  pdf: ['.pdf'],
  word: ['.docx', '.doc'],
  excel: ['.xlsx', '.xls'],
  powerpoint: ['.pptx', '.ppt'],
  email: ['.msg', '.eml'],
  image: ['.tiff', '.tif', '.png', '.jpg', '.jpeg', '.gif'],
  text: ['.txt', '.md'],
};

const FILE_CATEGORY_LABELS: Record<string, string> = {
  pdf: 'PDF Document',
  word: 'Word Document',
  excel: 'Excel Spreadsheet',
  powerpoint: 'PowerPoint Presentation',
  email: 'Email File',
  image: 'Image',
  text: 'Text Document',
};

const MAX_FILE_SIZES: Record<string, number> = {
  pdf: 100 * 1024 * 1024,       // 100MB for PDFs
  word: 50 * 1024 * 1024,       // 50MB for Word docs
  excel: 50 * 1024 * 1024,      // 50MB for Excel
  powerpoint: 100 * 1024 * 1024, // 100MB for PowerPoint
  email: 25 * 1024 * 1024,      // 25MB for emails
  image: 50 * 1024 * 1024,      // 50MB for images
  text: 10 * 1024 * 1024,       // 10MB for text
};

const MAX_GLOBAL_FILE_SIZE = 500 * 1024 * 1024; // 500MB hard limit

const EXTENSION_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.msg': 'application/vnd.ms-outlook',
  '.eml': 'message/rfc822',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

function resolveMimeType(mimetype: string, extension: string): string {
  if (mimetype === 'application/octet-stream') {
    return EXTENSION_TO_MIME[extension.toLowerCase()] || mimetype;
  }
  return mimetype;
}

function getAllAllowedMimeTypes(): string[] {
  return Object.values(ALLOWED_MIME_TYPES).flat();
}

function getAllAllowedExtensions(): string[] {
  return Object.values(ALLOWED_EXTENSIONS).flat();
}

function getFileCategory(mimetype: string, extension: string): string | null {
  for (const [category, mimes] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (mimes.includes(mimetype)) {
      return category;
    }
  }
  
  for (const [category, exts] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (exts.includes(extension.toLowerCase())) {
      return category;
    }
  }
  
  return null;
}

function computeChecksum(buffer: Buffer, algorithm: 'sha256' | 'md5' = 'sha256'): string {
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}

interface FileMetadata {
  original_filename: string;
  file_size: number;
  mimetype: string;
  file_extension: string;
  file_category: string;
  checksum_sha256: string;
  checksum_md5: string;
  upload_timestamp: string;
  requires_ocr: boolean;
  is_archival_format: boolean;
}

function extractFileMetadata(
  filename: string,
  mimetype: string,
  buffer: Buffer
): FileMetadata {
  const fileExtension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  const fileCategory = getFileCategory(mimetype, fileExtension) || 'unknown';
  
  const requiresOcr = ['image/tiff', 'image/png', 'image/jpeg', 'image/gif'].includes(mimetype) ||
    (mimetype === 'application/pdf');
  
  const isArchivalFormat = mimetype === 'application/pdf' || mimetype === 'image/tiff';
  
  return {
    original_filename: filename,
    file_size: buffer.length,
    mimetype,
    file_extension: fileExtension,
    file_category: fileCategory,
    checksum_sha256: computeChecksum(buffer, 'sha256'),
    checksum_md5: computeChecksum(buffer, 'md5'),
    upload_timestamp: new Date().toISOString(),
    requires_ocr: requiresOcr,
    is_archival_format: isArchivalFormat,
  };
}

/**
 * Legal Document Upload endpoint
 * POST /api/ai/legal-document/upload
 * 
 * Features:
 * - Comprehensive file type support for legal DMS
 * - SHA-256 and MD5 checksums for data integrity
 * - Metadata extraction and preservation
 * - OCR processing for scanned documents
 * - Full-text search indexing
 */
export default async function legalDocumentUploadRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/ai/legal-document/upload',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
      ],
    },
    async (request, reply) => {
      const tenant = (request as any).tenant;
      const user = request.user;

      if (!tenant || !tenant.id) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Tenant context not available',
          },
        });
      }

      if (!user || !user.id) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
          },
        });
      }

      try {
        // Use parts() to read all multipart fields (file + form data)
        // IMPORTANT: File streams must be consumed (toBuffer) inside the loop
        // before iterating to the next part, otherwise the stream hangs.
        const parts = request.parts();
        let filename: string = '';
        let rawMimetype: string = '';
        let fileBuffer: Buffer | null = null;
        const formFields: Record<string, string> = {};
        
        for await (const part of parts) {
          if (part.type === 'file') {
            filename = part.filename;
            rawMimetype = part.mimetype;
            fileBuffer = await part.toBuffer();
          } else {
            formFields[part.fieldname] = part.value as string;
          }
        }

        if (!fileBuffer || !filename) {
          return reply.status(400).send({
            error: {
              code: 'NO_FILE_UPLOADED',
              message: 'No file was uploaded',
            },
          });
        }

        const fileExtension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        const mimetype = resolveMimeType(rawMimetype, fileExtension);

        const fileCategory = getFileCategory(mimetype, fileExtension);

        if (!fileCategory) {
          request.log.warn(
            {
              filename,
              mimetype,
              fileExtension,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid file type for legal document upload'
          );
          return reply.status(400).send({
            error: {
              code: 'INVALID_FILE_TYPE',
              message: `Invalid file type. Supported formats: PDF, Word (.docx, .doc), Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt), Email (.msg, .eml), Images (.tiff, .png, .jpg, .gif), Text (.txt, .md). For audio/video files, use the dedicated Audio/Video pages.`,
            },
          });
        }

        const fileSize = fileBuffer.length;

        // Check global max file size (500MB hard limit)
        if (fileSize > MAX_GLOBAL_FILE_SIZE) {
          request.log.warn(
            {
              fileSize,
              maxSize: MAX_GLOBAL_FILE_SIZE,
              tenantId: tenant.id,
              userId: user.id,
            },
            'File exceeds maximum global size limit'
          );
          return reply.status(400).send({
            error: {
              code: 'FILE_TOO_LARGE',
              message: `File size (${Math.round(fileSize / (1024 * 1024))}MB) exceeds maximum allowed size of 500MB`,
            },
          });
        }

        const maxSize = MAX_FILE_SIZES[fileCategory] || 50 * 1024 * 1024;
        if (fileSize > maxSize) {
          request.log.warn(
            {
              filename,
              fileSize,
              maxSize,
              fileCategory,
              tenantId: tenant.id,
              userId: user.id,
            },
            'File size exceeds limit for category'
          );
          return reply.status(400).send({
            error: {
              code: 'FILE_TOO_LARGE',
              message: `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB for ${FILE_CATEGORY_LABELS[fileCategory]}`,
            },
          });
        }

        const metadata = extractFileMetadata(filename, mimetype, fileBuffer);

        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `tenant-${tenant.id}/legal-documents/${timestamp}_${sanitizedFilename}`;

        request.log.info(
          {
            filename: sanitizedFilename,
            storagePath,
            fileSize,
            mimetype,
            fileCategory,
            checksumSha256: metadata.checksum_sha256.substring(0, 16) + '...',
            tenantId: tenant.id,
            userId: user.id,
          },
          'Uploading legal document to storage'
        );

        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from('tenant-uploads')
          .upload(storagePath, fileBuffer, {
            upsert: false,
          });

        if (uploadError) {
          request.log.error(
            {
              filename: sanitizedFilename,
              storagePath,
              tenantId: tenant.id,
              error: uploadError.message,
            },
            'Failed to upload legal document to storage'
          );
          return reply.status(500).send({
            error: {
              code: 'UPLOAD_FAILED',
              message: 'Failed to upload document file',
            },
          });
        }

        request.log.info(
          {
            filename: sanitizedFilename,
            storagePath: uploadData.path,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Legal document uploaded successfully, dispatching processing job'
        );

        const processingOptions = {
          enable_ocr: formFields.enable_ocr === 'true',
          extract_text: formFields.extract_text === 'true',
          preserve_formatting: formFields.preserve_formatting === 'true',
          index_for_search: formFields.index_for_search === 'true',
          convert_to_pdf_a: formFields.convert_to_pdf_a === 'true',
          generate_summary: formFields.generate_summary === 'true',
          generate_article: formFields.generate_article === 'true',
          ai_model: formFields.ai_model || 'deepseek',
        };

        const job = await dispatchJob({
          tenantId: tenant.id,
          type: 'legal_document_process',
          payload: {
            storage_path: uploadData.path,
            user_id: user.id,
            metadata,
            processing_options: processingOptions,
          },
        });

        request.log.info(
          {
            jobId: job.id,
            storagePath: uploadData.path,
            tenantId: tenant.id,
            userId: user.id,
            fileCategory,
          },
          'Legal document processing job dispatched'
        );

        return reply.status(201).send({
          job,
          storage_path: uploadData.path,
          filename: sanitizedFilename,
          file_size: fileSize,
          file_category: fileCategory,
          file_category_label: FILE_CATEGORY_LABELS[fileCategory],
          checksums: {
            sha256: metadata.checksum_sha256,
            md5: metadata.checksum_md5,
          },
          metadata: {
            requires_ocr: metadata.requires_ocr,
            is_archival_format: metadata.is_archival_format,
          },
          processing_options: processingOptions,
          status: 'queued',
        });
      } catch (error) {
        request.log.error(
          {
            tenantId: tenant.id,
            userId: user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error in legal document upload endpoint'
        );

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while processing your request',
          },
        });
      }
    }
  );

  fastify.get(
    '/api/ai/legal-document/supported-types',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
      ],
    },
    async (_request, reply) => {
      return reply.send({
        categories: Object.entries(FILE_CATEGORY_LABELS).map(([key, label]) => ({
          id: key,
          label,
          mime_types: ALLOWED_MIME_TYPES[key] || [],
          extensions: ALLOWED_EXTENSIONS[key] || [],
          max_size_mb: (MAX_FILE_SIZES[key] || 50 * 1024 * 1024) / (1024 * 1024),
        })),
        total_extensions: getAllAllowedExtensions(),
        total_mime_types: getAllAllowedMimeTypes(),
        features: {
          checksum_verification: true,
          ocr_processing: true,
          metadata_extraction: true,
          full_text_search: true,
          pdf_a_conversion: true,
          digital_signature_preservation: true,
        },
      });
    }
  );
}
