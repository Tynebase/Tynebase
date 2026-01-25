/**
 * Video Ingestion Worker
 * Processes video_ingest jobs from the job queue
 * 
 * Workflow:
 * 1. Get signed URL from Supabase Storage
 * 2. Get video metadata (duration) using Gemini API
 * 3. Calculate credits (duration_minutes / 5)
 * 4. Stream video to Vertex AI Gemini API
 * 5. Receive transcript with timestamps
 * 6. Create document with transcript
 * 7. Create lineage event (type: converted_from_video)
 * 8. Log query_usage with credits
 * 9. Delete video from storage (optional config)
 * 10. Mark job as completed with document_id
 */

import { supabaseAdmin } from '../lib/supabase';
import { transcribeVideo } from '../services/ai/vertex';
import { transcribeAudioWithWhisper, extractAudioFromVideo } from '../services/ai/whisper';
import { completeJob } from '../utils/completeJob';
import { failJob } from '../utils/failJob';
import { calculateVideoIngestionCredits } from '../utils/creditCalculator';
import { z } from 'zod';
import ytDlp from 'yt-dlp-exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const VideoIngestPayloadSchema = z.object({
  storage_path: z.string().min(1).optional(),
  original_filename: z.string().min(1).optional(),
  file_size: z.number().int().positive().optional(),
  mimetype: z.string().min(1).optional(),
  user_id: z.string().uuid(),
  youtube_url: z.string().url().optional(),
  url: z.string().url().optional(),
}).refine(
  (data) => data.storage_path || data.youtube_url || data.url,
  { message: 'Either storage_path, youtube_url, or url must be provided' }
);

type VideoIngestPayload = z.infer<typeof VideoIngestPayloadSchema>;

interface Job {
  id: string;
  tenant_id: string;
  type: string;
  payload: VideoIngestPayload;
  worker_id: string;
}

/**
 * Configuration for video cleanup after processing
 */
const DELETE_VIDEO_AFTER_PROCESSING = process.env.DELETE_VIDEO_AFTER_PROCESSING === 'true';

/**
 * Process a video ingestion job
 * @param job - Job record from job_queue
 */
export async function processVideoIngestJob(job: Job): Promise<void> {
  const workerId = job.worker_id;
  
  console.log(`[Worker ${workerId}] Processing video ingestion job ${job.id}`);
  console.log(`[Worker ${workerId}] Tenant: ${job.tenant_id}, File: ${job.payload.original_filename}`);

  try {
    const validated = VideoIngestPayloadSchema.parse(job.payload);

    let videoUrl: string;
    let isYouTubeVideo = false;
    let originalFilename: string;
    let fileSize: number;

    if (validated.youtube_url || validated.url) {
      const youtubeUrl = validated.youtube_url || validated.url!;
      console.log(`[Worker ${workerId}] Processing YouTube video: ${youtubeUrl}`);
      videoUrl = youtubeUrl;
      isYouTubeVideo = true;
      originalFilename = validated.original_filename || `YouTube Video - ${new Date().toISOString()}`;
      fileSize = validated.file_size || 0;
    } else if (validated.storage_path) {
      const signedUrl = await getSignedVideoUrl(validated.storage_path, workerId);
      videoUrl = signedUrl;
      originalFilename = validated.original_filename!;
      fileSize = validated.file_size!;
      console.log(`[Worker ${workerId}] Generated signed URL for storage path: ${validated.storage_path}`);
    } else {
      throw new Error('No video source provided (storage_path, youtube_url, or url)');
    }

    console.log(`[Worker ${workerId}] Transcribing video with Gemini...`);
    let transcriptionResult;
    let transcript: string;
    let tokensUsed: number;
    let usedFallback = false;

    try {
      transcriptionResult = await transcribeVideo(
        videoUrl,
        'Transcribe this video content with timestamps. Include all spoken words and important visual context. Format the output as a readable transcript with clear sections.'
      );
      transcript = transcriptionResult.content;
      tokensUsed = transcriptionResult.tokensInput + transcriptionResult.tokensOutput;
    } catch (geminiError: any) {
      console.warn(`[Worker ${workerId}] Gemini transcription failed: ${geminiError.message}`);
      console.log(`[Worker ${workerId}] Falling back to yt-dlp + Whisper...`);

      try {
        const fallbackResult = await fallbackTranscription(videoUrl, isYouTubeVideo, workerId);
        transcript = fallbackResult.transcript;
        tokensUsed = fallbackResult.tokensUsed;
        usedFallback = true;
        console.log(`[Worker ${workerId}] Fallback transcription successful`);
      } catch (fallbackError: any) {
        console.error(`[Worker ${workerId}] Fallback transcription also failed:`, fallbackError);
        throw new Error(`Both Gemini and fallback transcription failed. Gemini: ${geminiError.message}, Fallback: ${fallbackError.message}`);
      }
    }

    console.log(`[Worker ${workerId}] Transcription completed: ${transcript.length} characters, ${tokensUsed} tokens`);

    const durationMinutes = estimateVideoDuration(transcript, fileSize);
    const creditsUsed = calculateVideoIngestionCredits(durationMinutes);

    console.log(`[Worker ${workerId}] Estimated duration: ${durationMinutes} minutes, Credits: ${creditsUsed}`);

    const documentTitle = generateDocumentTitle(originalFilename, transcript);

    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        tenant_id: job.tenant_id,
        title: documentTitle,
        content: transcript,
        status: 'draft',
        author_id: validated.user_id,
      })
      .select()
      .single();

    if (docError) {
      console.error(`[Worker ${workerId}] Failed to create document:`, docError);
      await failJob({
        jobId: job.id,
        error: 'Failed to create document',
        errorDetails: { message: docError.message, code: docError.code },
      });
      return;
    }

    console.log(`[Worker ${workerId}] Document created: ${document.id}`);

    const { error: lineageError } = await supabaseAdmin
      .from('document_lineage')
      .insert({
        document_id: document.id,
        event_type: 'converted_from_video',
        actor_id: validated.user_id,
        metadata: {
          original_filename: originalFilename,
          file_size: fileSize,
          mimetype: validated.mimetype || 'video/mp4',
          storage_path: validated.storage_path || null,
          duration_minutes: durationMinutes,
          tokens_used: tokensUsed,
          is_youtube: isYouTubeVideo,
          youtube_url: validated.youtube_url || validated.url || null,
          used_fallback: usedFallback,
          transcription_method: usedFallback ? 'whisper' : 'gemini',
        },
      });

    if (lineageError) {
      console.error(`[Worker ${workerId}] Failed to create lineage event:`, lineageError);
    } else {
      console.log(`[Worker ${workerId}] Lineage event created for document ${document.id}`);
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const { error: usageError } = await supabaseAdmin
      .from('query_usage')
      .insert({
        tenant_id: job.tenant_id,
        user_id: validated.user_id,
        query_type: 'video_ingestion',
        model: usedFallback ? 'whisper-large-v3-turbo' : transcriptionResult!.model,
        input_tokens: usedFallback ? Math.ceil(fileSize / 1000) : transcriptionResult!.tokensInput,
        output_tokens: usedFallback ? tokensUsed : transcriptionResult!.tokensOutput,
        credits_used: creditsUsed,
        month_year: currentMonth,
        metadata: {
          job_id: job.id,
          document_id: document.id,
          duration_minutes: durationMinutes,
          file_size: fileSize,
          is_youtube: isYouTubeVideo,
          used_fallback: usedFallback,
          transcription_method: usedFallback ? 'whisper' : 'gemini',
        },
      });

    if (usageError) {
      console.error(`[Worker ${workerId}] Failed to log query usage:`, usageError);
    } else {
      console.log(`[Worker ${workerId}] Query usage logged: ${creditsUsed} credits`);
    }

    if (!isYouTubeVideo && DELETE_VIDEO_AFTER_PROCESSING && validated.storage_path) {
      try {
        await deleteVideoFromStorage(validated.storage_path, workerId);
        console.log(`[Worker ${workerId}] Video deleted from storage: ${validated.storage_path}`);
      } catch (deleteError) {
        console.warn(`[Worker ${workerId}] Failed to delete video from storage:`, deleteError);
      }
    }

    await completeJob({
      jobId: job.id,
      result: {
        document_id: document.id,
        title: document.title,
        duration_minutes: durationMinutes,
        credits_used: creditsUsed,
        tokens_used: tokensUsed,
        transcript_length: transcript.length,
        is_youtube: isYouTubeVideo,
        used_fallback: usedFallback,
        transcription_method: usedFallback ? 'whisper' : 'gemini',
      },
    });

    console.log(`[Worker ${workerId}] Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`[Worker ${workerId}] Error processing video ingestion job:`, error);

    await failJob({
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: {
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        timestamp: new Date().toISOString(),
        storage_path: job.payload.storage_path,
      },
    });
  }
}

/**
 * Get a signed URL for accessing video from Supabase Storage
 * @param storagePath - Path to video in storage bucket
 * @param workerId - Worker ID for logging
 * @returns Signed URL valid for 1 hour
 */
async function getSignedVideoUrl(storagePath: string, workerId: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .storage
      .from('tenant-uploads')
      .createSignedUrl(storagePath, 3600);

    if (error) {
      console.error(`[Worker ${workerId}] Failed to create signed URL:`, error);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    if (!data || !data.signedUrl) {
      throw new Error('Signed URL not returned from Supabase');
    }

    return data.signedUrl;
  } catch (error) {
    console.error(`[Worker ${workerId}] Error getting signed URL:`, error);
    throw error;
  }
}

/**
 * Delete video from Supabase Storage after processing
 * @param storagePath - Path to video in storage bucket
 * @param workerId - Worker ID for logging
 */
async function deleteVideoFromStorage(storagePath: string, workerId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .storage
      .from('tenant-uploads')
      .remove([storagePath]);

    if (error) {
      console.error(`[Worker ${workerId}] Failed to delete video:`, error);
      throw new Error(`Failed to delete video: ${error.message}`);
    }
  } catch (error) {
    console.error(`[Worker ${workerId}] Error deleting video:`, error);
    throw error;
  }
}

/**
 * Estimate video duration based on transcript length and file size
 * This is a heuristic until we can extract actual duration from video metadata
 * @param transcript - Transcribed text
 * @param fileSize - Video file size in bytes
 * @returns Estimated duration in minutes
 */
function estimateVideoDuration(transcript: string, fileSize: number): number {
  const wordCount = transcript.split(/\s+/).length;
  const averageWordsPerMinute = 150;
  const estimatedMinutes = Math.ceil(wordCount / averageWordsPerMinute);
  
  const fileSizeMB = fileSize / (1024 * 1024);
  const estimatedMinutesFromSize = Math.ceil(fileSizeMB / 10);
  
  const finalEstimate = Math.max(estimatedMinutes, estimatedMinutesFromSize, 1);
  
  console.log(`[estimateVideoDuration] Words: ${wordCount}, Size: ${fileSizeMB.toFixed(2)}MB, Estimated: ${finalEstimate} minutes`);
  
  return finalEstimate;
}

/**
 * Generate a document title from the video filename and transcript
 * @param filename - Original video filename
 * @param transcript - Transcribed content
 * @returns Document title (max 100 chars)
 */
function generateDocumentTitle(filename: string, transcript: string): string {
  const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  const cleanFilename = filenameWithoutExt
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const firstLine = transcript.split('\n')[0]?.trim() || '';
  
  if (firstLine.length > 10 && firstLine.length <= 80 && !firstLine.includes('Transcript')) {
    const cleanedLine = firstLine.replace(/^#+\s*/, '').trim();
    if (cleanedLine.length > 0) {
      return cleanedLine.length <= 100 ? cleanedLine : cleanedLine.substring(0, 97) + '...';
    }
  }
  
  const title = cleanFilename.length > 0 && cleanFilename.length <= 80
    ? `Video: ${cleanFilename}`
    : `Video Transcript: ${cleanFilename.substring(0, 60)}...`;
  
  return title.length <= 100 ? title : title.substring(0, 97) + '...';
}

/**
 * Fallback transcription using yt-dlp + Whisper
 * Used when Gemini API fails
 * 
 * @param videoUrl - Video URL (signed URL or YouTube URL)
 * @param isYouTube - Whether this is a YouTube video
 * @param workerId - Worker ID for logging
 * @returns Transcript and token count
 */
async function fallbackTranscription(
  videoUrl: string,
  isYouTube: boolean,
  workerId: string
): Promise<{ transcript: string; tokensUsed: number }> {
  const tempDir = os.tmpdir();
  const videoFileName = `video_${Date.now()}.mp4`;
  const audioFileName = `audio_${Date.now()}.wav`;
  const videoPath = path.join(tempDir, videoFileName);
  const audioPath = path.join(tempDir, audioFileName);

  try {
    if (isYouTube) {
      console.log(`[Worker ${workerId}] Downloading YouTube video with yt-dlp...`);
      await ytDlp(videoUrl, {
        output: videoPath,
        format: 'best[ext=mp4]',
        noPlaylist: true,
      });
    } else {
      console.log(`[Worker ${workerId}] Downloading video from signed URL...`);
      const axios = require('axios');
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
      });

      const writer = fs.createWriteStream(videoPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });
    }

    console.log(`[Worker ${workerId}] Video downloaded: ${videoPath}`);

    const extractedAudioPath = await extractAudioFromVideo(videoPath, audioPath);
    console.log(`[Worker ${workerId}] Audio extracted: ${extractedAudioPath}`);

    const whisperResult = await transcribeAudioWithWhisper(extractedAudioPath);
    const transcript = whisperResult.content;
    const tokensUsed = whisperResult.tokensInput + whisperResult.tokensOutput;

    return { transcript, tokensUsed };
  } catch (error) {
    console.error(`[Worker ${workerId}] Fallback transcription error:`, error);
    throw error;
  } finally {
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
      console.log(`[Worker ${workerId}] Cleaned up temp video file`);
    }
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log(`[Worker ${workerId}] Cleaned up temp audio file`);
    }
  }
}
