import { FastifyInstance } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { creditGuardMiddleware } from '../middleware/creditGuard';
import { dispatchJob } from '../utils/dispatchJob';
import { uploadBufferToGCS } from '../services/storage/gcs';

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
];
const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB for audio

/**
 * Audio Upload endpoint
 * POST /api/ai/audio/upload
 * Accepts audio file upload, stores in Supabase Storage, and dispatches processing job
 */
export default async function audioUploadRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/ai/audio/upload',
    {
      preHandler: [
        rateLimitMiddleware,
        tenantContextMiddleware,
        authMiddleware,
        creditGuardMiddleware,
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
        // Use parts() to read all multipart fields
        // IMPORTANT: File streams must be consumed (toBuffer) inside the loop
        // before iterating to the next part, otherwise the stream hangs.
        const parts = request.parts();
        let filename: string = '';
        let mimetype: string = '';
        let fileBuffer: Buffer | null = null;
        const formFields: Record<string, string> = {};
        
        for await (const part of parts) {
          if (part.type === 'file') {
            filename = part.filename;
            mimetype = part.mimetype;
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
        
        // Parse form fields
        const formData = {
          generate_transcript: formFields.generate_transcript === 'true',
          generate_summary: formFields.generate_summary === 'true',
          generate_article: formFields.generate_article === 'true',
          ai_model: (formFields.ai_model as 'gemini' | 'deepseek' | 'claude') || 'gemini',
        };
        
        console.log('[Audio Upload] Received form data:', formData);

        if (!ALLOWED_AUDIO_TYPES.includes(mimetype)) {
          request.log.warn(
            {
              filename,
              mimetype,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid audio file type'
          );
          return reply.status(400).send({
            error: {
              code: 'INVALID_FILE_TYPE',
              message: `Invalid file type. Allowed types: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}`,
            },
          });
        }

        const fileExtension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_AUDIO_EXTENSIONS.includes(fileExtension)) {
          request.log.warn(
            {
              filename,
              fileExtension,
              tenantId: tenant.id,
              userId: user.id,
            },
            'Invalid audio file extension'
          );
          return reply.status(400).send({
            error: {
              code: 'INVALID_FILE_EXTENSION',
              message: `Invalid file extension. Allowed extensions: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}`,
            },
          });
        }

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
        const gcsFileName = `audio_${tenant.id}_${timestamp}_${sanitizedFilename}`;

        request.log.info(
          {
            filename: sanitizedFilename,
            gcsFileName,
            fileSize,
            mimetype,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Uploading audio to GCS'
        );

        let gcsUri: string;
        try {
          gcsUri = await uploadBufferToGCS(fileBuffer, gcsFileName, mimetype);
        } catch (uploadError: any) {
          request.log.error(
            {
              filename: sanitizedFilename,
              gcsFileName,
              tenantId: tenant.id,
              error: uploadError.message,
            },
            'Failed to upload audio to GCS'
          );
          return reply.status(500).send({
            error: {
              code: 'UPLOAD_FAILED',
              message: 'Failed to upload audio file',
            },
          });
        }

        request.log.info(
          {
            filename: sanitizedFilename,
            gcsUri,
            tenantId: tenant.id,
            userId: user.id,
            outputOptions: formData,
          },
          'Audio uploaded to GCS successfully, dispatching job'
        );

        // Use parsed form data for output options
        const outputOptions = {
          generate_transcript: formData.generate_transcript ?? true,
          generate_summary: formData.generate_summary ?? false,
          generate_article: formData.generate_article ?? false,
          ai_model: formData.ai_model ?? 'gemini',
        };

        const job = await dispatchJob({
          tenantId: tenant.id,
          type: 'audio_ingestion',
          payload: {
            gcs_uri: gcsUri,
            original_filename: sanitizedFilename,
            file_size: fileSize,
            mimetype: mimetype,
            user_id: user.id,
            output_options: outputOptions,
          },
        });

        request.log.info(
          {
            jobId: job.id,
            gcsUri,
            tenantId: tenant.id,
            userId: user.id,
          },
          'Audio ingestion job dispatched'
        );

        return reply.status(201).send({
          job,
          job_id: job.id,
          gcs_uri: gcsUri,
          filename: sanitizedFilename,
          file_size: fileSize,
          output_options: outputOptions,
          status: 'queued',
        });
      } catch (error) {
        request.log.error(
          {
            tenantId: tenant.id,
            userId: user?.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Error in audio upload endpoint'
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
