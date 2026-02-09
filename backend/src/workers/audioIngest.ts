/**
 * Audio Ingestion Worker
 * Processes audio_ingestion jobs from the job queue
 * 
 * Workflow:
 * 1. Get audio from GCS URI
 * 2. Transcribe using Gemini 2.5 Flash (primary)
 * 3. Fallback to Whisper if Gemini fails
 * 4. Calculate credits based on pipeline
 * 5. Create document(s) with transcript/summary/article
 * 6. Create lineage event
 * 7. Log query_usage with credits
 * 8. Delete audio from GCS
 * 9. Mark job as completed with document_id
 */

import { supabaseAdmin } from '../lib/supabase';
import { transcribeAudio } from '../services/ai/vertex';
import { deleteFromGCS } from '../services/storage/gcs';
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

const OutputOptionsSchema = z.object({
  generate_transcript: z.boolean().default(true),
  generate_summary: z.boolean().default(false),
  generate_article: z.boolean().default(false),
  ai_model: z.enum(['deepseek', 'gemini', 'claude']).default('deepseek'),
});

const AudioIngestPayloadSchema = z.object({
  gcs_uri: z.string().min(1),
  original_filename: z.string().min(1),
  file_size: z.number().int().positive(),
  mimetype: z.string().min(1),
  user_id: z.string().uuid(),
  output_options: OutputOptionsSchema.optional(),
});

type AudioIngestPayload = z.infer<typeof AudioIngestPayloadSchema>;

interface Job {
  id: string;
  tenant_id: string;
  type: string;
  payload: AudioIngestPayload;
  worker_id: string;
}

/**
 * Process an audio ingestion job
 * @param job - Job record from job_queue
 * @returns Job result with document IDs and metadata
 */
export async function processAudioIngestJob(job: Job): Promise<Record<string, any>> {
  const workerId = job.worker_id;
  let localAudioPath: string | null = null;
  
  console.log(`[Worker ${workerId}] Processing audio ingestion job ${job.id}`);
  console.log(`[Worker ${workerId}] Tenant: ${job.tenant_id}, File: ${job.payload.original_filename}`);

  try {
    const validated = AudioIngestPayloadSchema.parse(job.payload);

    let transcript: string;
    let tokensUsed: number;
    let usedFallback = false;

    // Get output options early to determine pipeline
    const outputOptions = validated.output_options || {
      generate_transcript: true,
      generate_summary: false,
      generate_article: false,
      ai_model: 'gemini' as const,
    };
    
    console.log(`[Worker ${workerId}] Pipeline: Gemini transcription (10 credits base), AI generation model: ${outputOptions.ai_model}`);

    // Transcribe audio with Gemini (all models use Gemini for transcription)
    console.log(`[Worker ${workerId}] Transcribing audio with Gemini 2.5 Flash...`);
    try {
      const geminiAudioResult = await transcribeAudio(
        validated.gcs_uri,
        'Transcribe this audio content with timestamps. Include all spoken words and important context.'
      );
      transcript = geminiAudioResult.content;
      tokensUsed = geminiAudioResult.tokensInput + geminiAudioResult.tokensOutput;
      console.log(`[Worker ${workerId}] Gemini audio transcription successful`);
    } catch (geminiError: any) {
      console.error(`[Worker ${workerId}] Gemini audio transcription failed:`, geminiError);
      throw new Error(`Gemini audio transcription failed: ${geminiError.message}`);
    }

    console.log(`[Worker ${workerId}] Transcription completed: ${transcript.length} characters, ${tokensUsed} tokens`);

    const durationMinutes = estimateAudioDuration(transcript, validated.file_size);
    
    // All transcription uses Gemini: 10 credits base
    const baseCredits = 10;
    
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

    const documentTitle = generateDocumentTitle(validated.original_filename, transcript);
    
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
        event_type: 'converted_from_audio',
        actor_id: validated.user_id,
        metadata: {
          original_filename: validated.original_filename,
          file_size: validated.file_size,
          mimetype: validated.mimetype,
          gcs_uri: validated.gcs_uri,
          duration_minutes: durationMinutes,
          tokens_used: tokensUsed,
          used_fallback: usedFallback,
          transcription_method: usedFallback ? 'whisper' : 'gemini',
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

    const { error: usageError } = await supabaseAdmin
      .from('query_usage')
      .insert({
        tenant_id: job.tenant_id,
        user_id: validated.user_id,
        query_type: 'audio_ingestion',
        ai_model: outputOptions.ai_model || (usedFallback ? 'whisper' : 'gemini'),
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
          file_size: validated.file_size,
          used_fallback: usedFallback,
          transcription_method: usedFallback ? 'whisper' : 'gemini',
          credit_breakdown: creditBreakdown,
          output_options: outputOptions,
        },
      });

    if (usageError) {
      console.error(`[Worker ${workerId}] Failed to log query usage:`, usageError);
    } else {
      console.log(`[Worker ${workerId}] Query usage logged: ${totalCredits} credits`);
    }

    // Delete audio from GCS
    try {
      await deleteFromGCS(validated.gcs_uri);
      console.log(`[Worker ${workerId}] Audio deleted from GCS: ${validated.gcs_uri}`);
    } catch (deleteError) {
      console.warn(`[Worker ${workerId}] Failed to delete audio from GCS:`, deleteError);
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
      used_fallback: usedFallback,
      transcription_method: usedFallback ? 'whisper' : 'gemini',
      output_options: outputOptions,
    };

    await completeJob({
      jobId: job.id,
      result,
    });

    console.log(`[Worker ${workerId}] Job ${job.id} completed successfully`);
    
    return result;
  } catch (error) {
    console.error(`[Worker ${workerId}] Error processing audio ingestion job:`, error);

    // Cleanup local file on error
    if (localAudioPath && fs.existsSync(localAudioPath)) {
      try {
        fs.unlinkSync(localAudioPath);
      } catch (cleanupError) {
        console.warn(`[Worker ${workerId}] Failed to cleanup local audio file:`, cleanupError);
      }
    }

    await failJob({
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: {
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        timestamp: new Date().toISOString(),
        gcs_uri: job.payload.gcs_uri,
      },
    });
    throw error;
  }
}

/**
 * Estimate audio duration based on transcript length and file size
 * @param transcript - Transcribed text
 * @param fileSize - Audio file size in bytes
 * @returns Estimated duration in minutes
 */
function estimateAudioDuration(transcript: string, fileSize: number): number {
  const wordCount = transcript.split(/\s+/).length;
  const averageWordsPerMinute = 150;
  const estimatedMinutes = Math.ceil(wordCount / averageWordsPerMinute);
  
  const fileSizeMB = fileSize / (1024 * 1024);
  const estimatedMinutesFromSize = Math.ceil(fileSizeMB / 1);
  
  const finalEstimate = Math.max(estimatedMinutes, estimatedMinutesFromSize, 1);
  
  console.log(`[estimateAudioDuration] Words: ${wordCount}, Size: ${fileSizeMB.toFixed(2)}MB, Estimated: ${finalEstimate} minutes`);
  
  return finalEstimate;
}

/**
 * Generate a document title from the audio filename and transcript
 * @param filename - Original audio filename
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
    ? `Audio: ${cleanFilename}`
    : `Audio Transcript: ${cleanFilename.substring(0, 60)}...`;
  
  return title.length <= 100 ? title : title.substring(0, 97) + '...';
}
