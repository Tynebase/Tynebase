/**
 * Video Ingestion Worker
 * Processes video_ingest jobs from the job queue
 * 
 * Workflow:
 * 1. Download audio via sidecar (YouTube) or get signed URL (upload) or download (direct URL)
 * 2. Upload to GCS
 * 3. Transcribe with Gemini 2.5 Flash
 * 4. Generate summary/article with selected AI model
 * 5. Create document(s)
 * 6. Create lineage event (type: converted_from_video)
 * 7. Log query_usage with credits
 * 8. Delete video from storage (optional config)
 * 9. Mark job as completed with document_id
 */

import { supabaseAdmin } from '../lib/supabase';
import { transcribeVideo, transcribeAudio } from '../services/ai/vertex';
import { uploadToGCS, deleteFromGCS } from '../services/storage/gcs';
import { completeJob } from '../utils/completeJob';
import { failJob } from '../utils/failJob';
import { getModelCreditCost } from '../utils/creditCalculator';
import { generateText } from '../services/ai/generation';
import type { AIModel } from '../services/ai/types';
import { z } from 'zod';

// Map frontend model names to backend AIModel types
const MODEL_MAP: Record<string, AIModel> = {
  'gemini': 'gemini-2.5-flash',
  'deepseek': 'deepseek-v3',
  'claude': 'claude-sonnet-4.5',
};
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';


const OutputOptionsSchema = z.object({
  generate_transcript: z.boolean().default(true),
  generate_summary: z.boolean().default(false),
  generate_article: z.boolean().default(false),
  ai_model: z.enum(['deepseek', 'gemini', 'claude']).default('deepseek'),
});

const VideoIngestPayloadSchema = z.object({
  storage_path: z.string().min(1).optional(),
  original_filename: z.string().min(1).optional(),
  file_size: z.number().int().positive().optional(),
  mimetype: z.string().min(1).optional(),
  user_id: z.string().uuid(),
  youtube_url: z.string().url().optional(),
  url: z.string().url().optional(),
  output_options: OutputOptionsSchema.optional(),
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
 * YouTube download sidecar URL (Python yt-dlp with PO-token provider)
 * Set this to your sidecar service URL in production
 * Example: http://yt-dlp-sidecar.internal:5000 (Fly.io internal URL)
 */
const YT_DLP_SIDECAR_URL = process.env.YT_DLP_SIDECAR_URL || '';

/**
 * Process a video ingestion job
 * @param job - Job record from job_queue
 * @returns Job result with document IDs and metadata
 */
export async function processVideoIngestJob(job: Job): Promise<Record<string, any>> {
  const workerId = job.worker_id;
  
  console.log(`[Worker ${workerId}] Processing video ingestion job ${job.id}`);
  console.log(`[Worker ${workerId}] Tenant: ${job.tenant_id}, File: ${job.payload.original_filename}`);

  try {
    const validated = VideoIngestPayloadSchema.parse(job.payload);

    let videoUrl: string;
    let isYouTubeVideo = false;
    let originalFilename: string;
    let fileSize: number;

    if (validated.youtube_url) {
      console.log(`[Worker ${workerId}] Processing YouTube video: ${validated.youtube_url}`);
      videoUrl = validated.youtube_url;
      isYouTubeVideo = true;
      originalFilename = validated.original_filename || `YouTube Video - ${new Date().toISOString()}`;
      fileSize = validated.file_size || 0;
    } else if (validated.url) {
      console.log(`[Worker ${workerId}] Processing direct URL video: ${validated.url}`);
      videoUrl = validated.url;
      isYouTubeVideo = false;
      originalFilename = validated.original_filename || `Video from URL - ${new Date().toISOString()}`;
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

    let transcriptionResult;
    let transcript: string;
    let tokensUsed: number;
    let localVideoPath: string | null = null;

    // Get output options early to determine pipeline
    const outputOptions = validated.output_options || {
      generate_transcript: true,
      generate_summary: false,
      generate_article: false,
      ai_model: 'gemini' as const,
    };
    
    console.log(`[Worker ${workerId}] Pipeline: Gemini transcription (10 credits base), AI generation model: ${outputOptions.ai_model}`);

    // For YouTube videos: Sidecar (proxy + PO token) → Download audio → GCS → Gemini 2.5 Flash transcription
    // Note: Transcription is ALWAYS Gemini regardless of ai_model selection.
    // The ai_model setting only affects summary/article generation downstream.
    if (isYouTubeVideo) {
      console.log(`[Worker ${workerId}] YouTube pipeline: sidecar download → GCS → Gemini transcription (generation model: ${outputOptions.ai_model})`);
      try {
        const tempDir = os.tmpdir();
        const videoFileBase = `yt_${Date.now()}_${job.id.slice(0, 8)}`;
        const outputTemplate = path.join(tempDir, videoFileBase + '.%(ext)s');
        
        console.log(`[Worker ${workerId}] Downloading audio via sidecar (proxy + PO token)...`);
        localVideoPath = await downloadYouTubeAudio(videoUrl, outputTemplate, workerId);
        const stats = fs.statSync(localVideoPath);
        fileSize = stats.size;
        
        // Upload to GCS
        const gcsFileName = `${videoFileBase}.mp3`;
        console.log(`[Worker ${workerId}] Uploading audio to GCS: ${gcsFileName}`);
        const gcsUri = await uploadToGCS(localVideoPath, gcsFileName, 'audio/mpeg');
        console.log(`[Worker ${workerId}] Audio uploaded to: ${gcsUri}`);
        
        // Transcribe using Gemini 2.5 Flash with audio
        console.log(`[Worker ${workerId}] Transcribing audio with Gemini 2.5 Flash...`);
        const geminiAudioResult = await transcribeAudio(
          gcsUri,
          'Transcribe this audio content with timestamps. Include all spoken words and important context.'
        );
        transcript = geminiAudioResult.content;
        tokensUsed = geminiAudioResult.tokensInput + geminiAudioResult.tokensOutput;
        console.log(`[Worker ${workerId}] Gemini audio transcription successful`);
        
        // Cleanup GCS and local file
        await deleteFromGCS(gcsUri);
        if (localVideoPath && fs.existsSync(localVideoPath)) {
          fs.unlinkSync(localVideoPath);
        }
      } catch (error: any) {
        console.error(`[Worker ${workerId}] YouTube transcription failed:`, error);
        if (localVideoPath && fs.existsSync(localVideoPath)) {
          fs.unlinkSync(localVideoPath);
        }
        throw new Error(`YouTube transcription failed: ${error.message}`);
      }
    } else if (validated.url && !validated.storage_path) {
      // Direct URL from external video platform (Vimeo, Dailymotion, etc.) or direct file URL
      // These URLs can't be passed directly to Gemini - must download first, upload to GCS, then transcribe
      console.log(`[Worker ${workerId}] Processing direct URL video via download pipeline...`);
      try {
        const tempDir = os.tmpdir();
        const videoFileBase = `url_${Date.now()}_${job.id.slice(0, 8)}`;
        const outputTemplate = path.join(tempDir, videoFileBase + '.%(ext)s');

        console.log(`[Worker ${workerId}] Downloading video/audio from URL...`);
        localVideoPath = await downloadVideoFromURL(videoUrl, outputTemplate, workerId);
        const stats = fs.statSync(localVideoPath);
        fileSize = stats.size;
        console.log(`[Worker ${workerId}] Downloaded: ${localVideoPath} (${fileSize} bytes)`);

        // Upload to GCS
        const gcsFileName = `${videoFileBase}.mp3`;
        console.log(`[Worker ${workerId}] Uploading audio to GCS: ${gcsFileName}`);
        const gcsUri = await uploadToGCS(localVideoPath, gcsFileName, 'audio/mpeg');
        console.log(`[Worker ${workerId}] Audio uploaded to: ${gcsUri}`);

        // Transcribe using Gemini with audio
        console.log(`[Worker ${workerId}] Transcribing audio with Gemini (generation model: ${outputOptions.ai_model})...`);
        const geminiAudioResult = await transcribeAudio(
          gcsUri,
          'Transcribe this audio content with timestamps. Include all spoken words and important context.'
        );
        transcript = geminiAudioResult.content;
        tokensUsed = geminiAudioResult.tokensInput + geminiAudioResult.tokensOutput;
        console.log(`[Worker ${workerId}] Gemini audio transcription successful`);

        // Cleanup GCS and local file
        await deleteFromGCS(gcsUri);
        if (localVideoPath && fs.existsSync(localVideoPath)) {
          fs.unlinkSync(localVideoPath);
        }
      } catch (error: any) {
        console.error(`[Worker ${workerId}] Direct URL video processing failed:`, error);
        if (localVideoPath && fs.existsSync(localVideoPath)) {
          fs.unlinkSync(localVideoPath);
        }
        throw new Error(`Direct URL video processing failed: ${error.message}`);
      }
    } else {
      // For uploaded videos with signed URLs (from Supabase Storage)
      // Transcription is ALWAYS Gemini — ai_model only affects summary/article generation
      console.log(`[Worker ${workerId}] Transcribing uploaded video with Gemini (generation model: ${outputOptions.ai_model})...`);
      try {
        transcriptionResult = await transcribeVideo(
          videoUrl,
          'Transcribe this video content with timestamps. Include all spoken words and important visual context. Format the output as a readable transcript with clear sections.'
        );
        transcript = transcriptionResult.content;
        tokensUsed = transcriptionResult.tokensInput + transcriptionResult.tokensOutput;
      } catch (geminiError: any) {
        console.error(`[Worker ${workerId}] Gemini video transcription failed:`, geminiError);
        throw new Error(`Gemini video transcription failed: ${geminiError.message}`);
      }
    }

    console.log(`[Worker ${workerId}] Transcription completed: ${transcript.length} characters, ${tokensUsed} tokens`);

    const durationMinutes = estimateVideoDuration(transcript, fileSize);
    
    // All transcription uses Gemini: 5 credits base (6 if Claude output)
    const isClaudeOutput = (outputOptions.ai_model || '').includes('claude');
    const baseCredits = isClaudeOutput ? 6 : 5;
    
    // Map frontend model name to backend model name for credit calculation
    const backendModelName = MODEL_MAP[outputOptions.ai_model] || 'gemini-2.5-flash';
    const modelCreditCost = getModelCreditCost(backendModelName);
    
    let totalCredits = baseCredits;
    const creditBreakdown: Record<string, number> = { base: baseCredits };
    
    if (outputOptions.generate_transcript) {
      totalCredits += modelCreditCost;
      creditBreakdown.transcript = modelCreditCost;
    }
    if (outputOptions.generate_summary) {
      totalCredits += modelCreditCost;
      creditBreakdown.summary = modelCreditCost;
    }
    if (outputOptions.generate_article) {
      totalCredits += modelCreditCost;
      creditBreakdown.article = modelCreditCost;
    }

    console.log(`[Worker ${workerId}] Estimated duration: ${durationMinutes} minutes, Credits: ${totalCredits}`, creditBreakdown);

    const documentTitle = generateDocumentTitle(originalFilename, transcript);
    
    // Track created document IDs
    let transcriptDocId: string | null = null;
    let summaryDocId: string | null = null;
    let articleDocId: string | null = null;
    let primaryDocId: string | null = null;

    // Create transcript document if requested
    if (outputOptions.generate_transcript) {
      const { data: transcriptDoc, error: transcriptError } = await supabaseAdmin
        .from('documents')
        .insert({
          tenant_id: job.tenant_id,
          title: `${documentTitle} - Transcript`,
          content: transcript,
          status: 'draft',
          author_id: validated.user_id,
        })
        .select()
        .single();

      if (transcriptError) {
        console.error(`[Worker ${workerId}] Failed to create transcript document:`, transcriptError);
      } else {
        transcriptDocId = transcriptDoc.id;
        primaryDocId = transcriptDoc.id;
        console.log(`[Worker ${workerId}] Transcript document created: ${transcriptDocId}`);
      }
    }

    // Generate AI summary if requested
    if (outputOptions.generate_summary && transcript.length > 100) {
      console.log(`[Worker ${workerId}] Generating AI summary using ${backendModelName}...`);
      try {
        const summaryPrompt = `Generate a concise summary of the following transcript. Focus on key points, main topics discussed, and important takeaways. Format as clear bullet points or short paragraphs.\n\nTranscript:\n${transcript.substring(0, 50000)}`;
        
        const summaryResponse = await generateText({
          prompt: summaryPrompt,
          model: backendModelName,
          maxTokens: 2000,
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
          if (!primaryDocId) primaryDocId = summaryDoc.id;
          console.log(`[Worker ${workerId}] Summary document created: ${summaryDocId}`);
        }
      } catch (error) {
        console.error(`[Worker ${workerId}] Failed to generate summary:`, error);
      }
    }

    // Generate AI article if requested
    if (outputOptions.generate_article && transcript.length > 100) {
      console.log(`[Worker ${workerId}] Generating AI article using ${backendModelName}...`);
      try {
        const articlePrompt = `Transform the following transcript into a well-formatted, professional article or documentation. Improve readability, add proper structure with headings, remove filler words, and enhance clarity while preserving all important information. Use markdown formatting.\n\nTranscript:\n${transcript.substring(0, 50000)}`;
        
        const articleResponse = await generateText({
          prompt: articlePrompt,
          model: backendModelName,
          maxTokens: 4000,
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
          if (!primaryDocId) primaryDocId = articleDoc.id;
          console.log(`[Worker ${workerId}] Article document created: ${articleDocId}`);
        }
      } catch (error) {
        console.error(`[Worker ${workerId}] Failed to generate article:`, error);
      }
    }

    // Fallback: create at least one document with the transcript
    if (!primaryDocId) {
      const { data: fallbackDoc, error: fallbackError } = await supabaseAdmin
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

      if (fallbackError) {
        console.error(`[Worker ${workerId}] Failed to create fallback document:`, fallbackError);
        await failJob({
          jobId: job.id,
          error: 'Failed to create document',
          errorDetails: { message: fallbackError.message, code: fallbackError.code },
        });
        throw new Error('Failed to create document');
      }
      primaryDocId = fallbackDoc.id;
      transcriptDocId = fallbackDoc.id;
    }

    console.log(`[Worker ${workerId}] Primary document: ${primaryDocId}`);

    // Create lineage event for primary document
    const { error: lineageError } = await supabaseAdmin
      .from('document_lineage')
      .insert({
        document_id: primaryDocId,
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
          transcription_method: 'gemini',
          output_options: outputOptions,
          created_documents: {
            transcript: transcriptDocId,
            summary: summaryDocId,
            article: articleDocId,
          },
        },
      });

    if (lineageError) {
      console.error(`[Worker ${workerId}] Failed to create lineage event:`, lineageError);
    } else {
      console.log(`[Worker ${workerId}] Lineage event created for document ${primaryDocId}`);
    }

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
        query_type: 'video_ingestion',
        ai_model: outputOptions.ai_model || 'gemini',
        tokens_input: tokensUsed,
        tokens_output: 0,
        credits_charged: totalCredits,
        metadata: {
          job_id: job.id,
          primary_document_id: primaryDocId,
          transcript_document_id: transcriptDocId,
          summary_document_id: summaryDocId,
          article_document_id: articleDocId,
          duration_minutes: durationMinutes,
          file_size: fileSize,
          is_youtube: isYouTubeVideo,
          transcription_method: 'gemini',
          credit_breakdown: creditBreakdown,
          output_options: outputOptions,
        },
      });

    if (usageError) {
      console.error(`[Worker ${workerId}] Failed to log query usage:`, usageError);
    } else {
      console.log(`[Worker ${workerId}] Query usage logged: ${totalCredits} credits`);
    }

    if (!isYouTubeVideo && DELETE_VIDEO_AFTER_PROCESSING && validated.storage_path) {
      try {
        await deleteVideoFromStorage(validated.storage_path, workerId);
        console.log(`[Worker ${workerId}] Video deleted from storage: ${validated.storage_path}`);
      } catch (deleteError) {
        console.warn(`[Worker ${workerId}] Failed to delete video from storage:`, deleteError);
      }
    }

    const result = {
      document_id: primaryDocId,
      transcript_document_id: transcriptDocId,
      summary_document_id: summaryDocId,
      article_document_id: articleDocId,
      title: documentTitle,
      duration_minutes: durationMinutes,
      credits_charged: totalCredits,
      credit_breakdown: creditBreakdown,
      tokens_used: tokensUsed,
      transcript_length: transcript.length,
      is_youtube: isYouTubeVideo,
      transcription_method: 'gemini',
      output_options: outputOptions,
    };

    await completeJob({
      jobId: job.id,
      result,
    });

    console.log(`[Worker ${workerId}] Job ${job.id} completed successfully`);
    
    return result;
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
    // Re-throw so outer handler knows job failed
    throw error;
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
 * Download YouTube audio with retry logic and multiple strategies
 * Handles 403 errors by trying different yt-dlp player client configurations
 * 
 * @param videoUrl - YouTube URL
 * @param outputTemplate - Output path template with %(ext)s
 * @param workerId - Worker ID for logging
 */
async function downloadYouTubeAudio(
  videoUrl: string,
  outputTemplate: string,
  workerId: string
): Promise<string> {
  // Use sidecar (required)
  if (YT_DLP_SIDECAR_URL) {
    console.log(`[Worker ${workerId}] Using yt-dlp sidecar: ${YT_DLP_SIDECAR_URL}`);
    return await downloadFromSidecar(videoUrl, outputTemplate, workerId);
  }

  throw new Error('YT_DLP_SIDECAR_URL not configured - sidecar is required for YouTube downloads');
}

/**
 * Download YouTube video using the Python sidecar service
 * @param videoUrl - YouTube URL
 * @param outputTemplate - Output path template
 * @param workerId - Worker ID for logging
 */
async function downloadFromSidecar(
  videoUrl: string,
  outputTemplate: string,
  workerId: string
): Promise<string> {
  const axios = require('axios');
  
  try {
    console.log(`[Worker ${workerId}] Requesting download from sidecar: ${videoUrl}`);
    
    const response = await axios({
      method: 'POST',
      url: `${YT_DLP_SIDECAR_URL}/download`,
      data: {
        url: videoUrl,
        format: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
        extract_audio: true,
      },
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout
      validateStatus: () => true,
    });

    if (response.status === 413) {
      // Duration exceeded — read the JSON error body from the stream
      const chunks: Buffer[] = [];
      for await (const chunk of response.data) chunks.push(Buffer.from(chunk));
      let body: any = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch {}
      throw new Error(body.error || 'Video exceeds the 20-minute maximum duration');
    }
    if (response.status >= 400) {
      throw new Error(`Sidecar returned HTTP ${response.status}`);
    }
    
    // Extract base path from template
    const basePath = outputTemplate.replace('.%(ext)s', '');
    const outputPath = `${basePath}.mp3`;
    
    // Stream response to file
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });
    
    console.log(`[Worker ${workerId}] Sidecar download complete: ${outputPath}`);
    return outputPath;
    
  } catch (error: any) {
    console.error(`[Worker ${workerId}] Sidecar download failed:`, error.message);
    throw new Error(`Sidecar download failed: ${error.message}`);
  }
}

/**
 * Check if a URL points to a direct video/audio file (e.g. .mp4, .webm, .mp3)
 */
function isDirectFileUrl(url: string): boolean {
  const videoExtensions = /\.(mp4|webm|mkv|avi|mov|flv|wmv|mp3|m4a|ogg|wav|aac)(\?.*)?$/i;
  return videoExtensions.test(url);
}

/**
 * Download video/audio from any URL (Vimeo, Dailymotion, TikTok, direct file, etc.)
 * Strategy:
 *   1. If sidecar is available, try yt-dlp generic download (supports 1000+ sites)
 *   2. If sidecar fails or URL is a direct file, fall back to HTTP download
 * 
 * @param videoUrl - Any video URL
 * @param outputTemplate - Output path template with %(ext)s
 * @param workerId - Worker ID for logging
 */
async function downloadVideoFromURL(
  videoUrl: string,
  outputTemplate: string,
  workerId: string
): Promise<string> {
  const axios = require('axios');
  const basePath = outputTemplate.replace('.%(ext)s', '');
  const outputPath = `${basePath}.mp3`;

  // Strategy 1: Try yt-dlp sidecar generic endpoint (handles Vimeo, Dailymotion, Twitter, etc.)
  if (YT_DLP_SIDECAR_URL) {
    try {
      console.log(`[Worker ${workerId}] Trying sidecar /download-generic for: ${videoUrl}`);
      const response = await axios({
        method: 'POST',
        url: `${YT_DLP_SIDECAR_URL}/download-generic`,
        data: {
          url: videoUrl,
          format: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
          extract_audio: true,
        },
        responseType: 'stream',
        timeout: 300000, // 5 minutes
        validateStatus: () => true,
      });

      if (response.status === 413) {
        const chunks: Buffer[] = [];
        for await (const chunk of response.data) chunks.push(Buffer.from(chunk));
        let body: any = {};
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch {}
        // Propagate a clear, non-fallback error — don't try HTTP fallback for duration rejection
        throw new Error(body.error || 'Video exceeds the 20-minute maximum duration');
      }
      if (response.status >= 400) {
        throw new Error(`Sidecar returned HTTP ${response.status}`);
      }

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      // Verify file was written
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log(`[Worker ${workerId}] Sidecar generic download complete: ${outputPath}`);
        return outputPath;
      }
      console.warn(`[Worker ${workerId}] Sidecar returned empty file, falling back to HTTP download`);
    } catch (sidecarError: any) {
      // Duration rejection must NOT fall back to HTTP (we'd bypass the check)
      if (/exceeds the 20-minute|DURATION_EXCEEDED/i.test(sidecarError?.message || '')) {
        throw sidecarError;
      }
      console.warn(`[Worker ${workerId}] Sidecar generic download failed: ${sidecarError.message}, falling back to HTTP download`);
    }
  }

  // Strategy 2: Direct HTTP download (for plain file URLs like .mp4, .webm)
  if (isDirectFileUrl(videoUrl)) {
    try {
      console.log(`[Worker ${workerId}] Downloading direct file URL: ${videoUrl}`);
      const directOutputPath = `${basePath}${path.extname(new URL(videoUrl).pathname) || '.mp4'}`;

      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
        timeout: 300000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const writer = fs.createWriteStream(directOutputPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      if (fs.existsSync(directOutputPath) && fs.statSync(directOutputPath).size > 0) {
        console.log(`[Worker ${workerId}] Direct HTTP download complete: ${directOutputPath}`);
        return directOutputPath;
      }
      throw new Error('Downloaded file is empty');
    } catch (httpError: any) {
      throw new Error(`Direct HTTP download failed: ${httpError.message}`);
    }
  }

  throw new Error(
    `Unable to download video from URL: ${videoUrl}. ` +
    (YT_DLP_SIDECAR_URL ? 'yt-dlp sidecar could not process this URL and it is not a direct file URL.' : 'YT_DLP_SIDECAR_URL not configured and URL is not a direct file link.')
  );
}

