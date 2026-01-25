import { FastifyInstance } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { dispatchJob } from '../utils/dispatchJob';

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];

const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.md', '.txt'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Document Import endpoint
 * POST /api/documents/import
 * Accepts document file upload (PDF, DOCX, MD), stores in Supabase Storage, and dispatches conversion job
 */
export default async function documentImportRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/documents/import',
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
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            error: {
              code: 'NO_FILE_UPLOADED',
              message: 'No file was uploaded',
            },
          });
        }

        const filename = data.filename;
        const mimetype = data.mimetype;

        if (!ALLOWED_DOCUMENT_TYPES.includes(mimetype)) {
          request.log.warn(
            {
              filename,
              mimetype,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid document file type'
          );
          return reply.status(400).send({
            error: {
              code: 'INVALID_FILE_TYPE',
              message: `Invalid file type. Allowed types: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`,
            },
          });
        }

        const fileExtension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(fileExtension)) {
          request.log.warn(
            {
              filename,
              fileExtension,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid document file extension'
          );
          return reply.status(400).send({
            error: {
              code: 'INVALID_FILE_EXTENSION',
              message: `Invalid file extension. Allowed extensions: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`,
            },
          });
        }

        const fileBuffer = await data.toBuffer();
        const fileSize = fileBuffer.length;

        if (fileSize > MAX_FILE_SIZE) {
          request.log.warn(
            {
              filename,
              fileSize,
              maxSize: MAX_FILE_SIZE,
              tenantId: tenant.id,
              userId: user.id,
            },
            'File size exceeds limit'
          );
          return reply.status(400).send({
            error: {
              code: 'FILE_TOO_LARGE',
              message: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
            },
          });
        }

        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `tenant-${tenant.id}/${timestamp}_${sanitizedFilename}`;

        request.log.info(
          {
            filename: sanitizedFilename,
            storagePath,
            fileSize,
            mimetype,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Uploading document to storage'
        );

        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from('tenant-uploads')
          .upload(storagePath, fileBuffer, {
            contentType: mimetype,
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
            'Failed to upload document to storage'
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
          'Document uploaded successfully, dispatching job'
        );

        const job = await dispatchJob({
          tenantId: tenant.id,
          type: 'document_convert',
          payload: {
            storage_path: uploadData.path,
            original_filename: sanitizedFilename,
            file_size: fileSize,
            mimetype: mimetype,
            user_id: user.id,
            file_extension: fileExtension,
          },
        });

        request.log.info(
          {
            jobId: job.id,
            storagePath: uploadData.path,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Document conversion job dispatched'
        );

        return reply.status(201).send({
          job_id: job.id,
          storage_path: uploadData.path,
          filename: sanitizedFilename,
          file_size: fileSize,
          status: 'queued',
        });
      } catch (error) {
        request.log.error(
          {
            tenantId: tenant.id,
            userId: user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error in document import endpoint'
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
}
