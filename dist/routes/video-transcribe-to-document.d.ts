import { FastifyInstance } from 'fastify';
/**
 * Video Transcribe to Document endpoint
 * POST /api/documents/:id/transcribe-video
 *
 * Transcribes an embedded video and appends the transcript to the document
 * Flow: Sidecar → GCS → Gemini 2.5 Flash → Generate with selected model → Append MD to document
 *
 * Cost: 10 credits base + 2 per summary/article output
 */
export default function videoTranscribeToDocumentRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=video-transcribe-to-document.d.ts.map