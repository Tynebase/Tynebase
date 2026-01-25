import { FastifyInstance } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { dispatchJob } from '../utils/dispatchJob';

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi'];
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/**
 * Video Upload endpoint
 * POST /api/ai/video/upload
 * Accepts video file upload, stores in Supabase Storage, and dispatches processing job
 */
export default async function videoUploadRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/ai/video/upload',
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

        if (!ALLOWED_VIDEO_TYPES.includes(mimetype)) {
          request.log.warn(
            {
              filename,
              mimetype,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid video file type'
          );
          return reply.status(400).send({
            error: {
              code: 'INVALID_FILE_TYPE',
              message: `Invalid file type. Allowed types: ${ALLOWED_VIDEO_EXTENSIONS.join(', ')}`,
            },
          });
        }

        const fileExtension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_VIDEO_EXTENSIONS.includes(fileExtension)) {
          request.log.warn(
            {
              filename,
              fileExtension,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid video file extension'
          );
          return reply.status(400).send({
            error: {
              code: 'INVALID_FILE_EXTENSION',
              message: `Invalid file extension. Allowed extensions: ${ALLOWED_VIDEO_EXTENSIONS.join(', ')}`,
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
          'Uploading video to storage'
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
            'Failed to upload video to storage'
          );
          return reply.status(500).send({
            error: {
              code: 'UPLOAD_FAILED',
              message: 'Failed to upload video file',
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
          'Video uploaded successfully, dispatching job'
        );

        const job = await dispatchJob({
          tenantId: tenant.id,
          type: 'video_ingestion',
          payload: {
            storage_path: uploadData.path,
            original_filename: sanitizedFilename,
            file_size: fileSize,
            mimetype: mimetype,
            user_id: user.id,
          },
        });

        request.log.info(
          {
            jobId: job.id,
            storagePath: uploadData.path,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Video ingestion job dispatched'
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
          'Error in video upload endpoint'
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
