"use strict";
/**
 * Video Transcribe to Document Worker
 * Processes video_transcribe_to_document jobs from the job queue
 *
 * Flow:
 * 1. Download video via sidecar (YouTube) or get from Supabase Storage (uploaded)
 * 2. Upload to GCS
 * 3. Transcribe with Gemini 2.5 Flash
 * 4. Generate summary/article with selected AI model
 * 5. Format as Markdown
 * 6. Append to document content
 * 7. Charge credits
 * 8. Log query_usage
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideoTranscribeToDocumentJob = processVideoTranscribeToDocumentJob;
const supabase_1 = require("../lib/supabase");
const vertex_1 = require("../services/ai/vertex");
const generation_1 = require("../services/ai/generation");
const gcs_1 = require("../services/storage/gcs");
const completeJob_1 = require("../utils/completeJob");
const failJob_1 = require("../utils/failJob");
const zod_1 = require("zod");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const axios_1 = __importDefault(require("axios"));
// Map frontend model names to backend AIModel types
const MODEL_MAP = {
    'gemini': 'gemini-2.5-flash',
    'deepseek': 'deepseek-v3',
    'claude': 'claude-sonnet-4.5',
};
const VideoTranscribePayloadSchema = zod_1.z.object({
    document_id: zod_1.z.string().uuid(),
    video_url: zod_1.z.string().url(),
    video_type: zod_1.z.enum(['youtube', 'uploaded']),
    user_id: zod_1.z.string().uuid(),
    credits_to_charge: zod_1.z.number().default(10),
    output_options: zod_1.z.object({
        generate_transcript: zod_1.z.boolean(),
        generate_summary: zod_1.z.boolean(),
        generate_article: zod_1.z.boolean(),
        append_to_document: zod_1.z.boolean(),
        ai_model: zod_1.z.string(),
    }).optional(),
});
const YT_DLP_SIDECAR_URL = process.env.YT_DLP_SIDECAR_URL || '';
/**
 * Process a video transcribe to document job
 * @param job - Job record from job_queue
 * @returns Job result with transcript metadata
 */
async function processVideoTranscribeToDocumentJob(job) {
    const workerId = job.worker_id;
    console.log(`[Worker ${workerId}] Processing video transcribe to document job ${job.id}`);
    console.log(`[Worker ${workerId}] Tenant: ${job.tenant_id}`);
    console.log(`[Worker ${workerId}] YT_DLP_SIDECAR_URL configured: ${YT_DLP_SIDECAR_URL ? YT_DLP_SIDECAR_URL : 'NOT SET'}`);
    console.log(`[Worker ${workerId}] Raw job payload:`, JSON.stringify(job.payload));
    try {
        const validated = VideoTranscribePayloadSchema.parse(job.payload);
        console.log(`[Worker ${workerId}] Validated payload output_options:`, JSON.stringify(validated.output_options));
        // Get document
        const { data: document, error: docError } = await supabase_1.supabaseAdmin
            .from('documents')
            .select('id, tenant_id, title, content')
            .eq('id', validated.document_id)
            .eq('tenant_id', job.tenant_id)
            .single();
        if (docError || !document) {
            throw new Error('Document not found or access denied');
        }
        console.log(`[Worker ${workerId}] Document: ${document.title}`);
        console.log(`[Worker ${workerId}] Video URL: ${validated.video_url}`);
        console.log(`[Worker ${workerId}] Video Type: ${validated.video_type}`);
        let localAudioPath = null;
        let gcsUri = null;
        let transcript;
        try {
            // Step 1: Download audio
            const tempDir = os.tmpdir();
            const audioFileBase = `video_transcribe_${Date.now()}_${job.id.slice(0, 8)}`;
            if (validated.video_type === 'youtube') {
                console.log(`[Worker ${workerId}] Downloading YouTube audio via sidecar...`);
                const outputTemplate = path.join(tempDir, audioFileBase + '.%(ext)s');
                localAudioPath = await downloadYouTubeAudio(validated.video_url, outputTemplate, workerId);
            }
            else {
                console.log(`[Worker ${workerId}] Downloading uploaded video from Supabase Storage...`);
                localAudioPath = await downloadFromSupabaseStorage(validated.video_url, tempDir, audioFileBase, workerId);
            }
            // Step 2: Upload to GCS
            const gcsFileName = `${audioFileBase}.mp3`;
            console.log(`[Worker ${workerId}] Uploading audio to GCS: ${gcsFileName}`);
            gcsUri = await (0, gcs_1.uploadToGCS)(localAudioPath, gcsFileName, 'audio/mpeg');
            console.log(`[Worker ${workerId}] Audio uploaded to: ${gcsUri}`);
            // Parse output options from validated payload
            const outputOptions = validated.output_options || {
                generate_transcript: true,
                generate_summary: false,
                generate_article: false,
                append_to_document: true,
                ai_model: 'gemini',
            };
            console.log(`[Worker ${workerId}] Output options:`, JSON.stringify(outputOptions));
            // Step 3: Transcribe with Gemini 2.5 Flash (always needed for summary/article generation)
            console.log(`[Worker ${workerId}] Transcribing audio with Gemini 2.5 Flash (europe-west1)...`);
            try {
                const geminiResult = await (0, vertex_1.transcribeAudio)(gcsUri, 'Transcribe this audio content with timestamps. Format the output as clean Markdown with proper headings and structure.');
                transcript = geminiResult.content;
                console.log(`[Worker ${workerId}] Gemini transcription successful: ${transcript.length} characters`);
            }
            catch (geminiError) {
                console.error(`[Worker ${workerId}] Gemini transcription failed:`, geminiError);
                throw new Error(`Gemini transcription failed: ${geminiError.message}`);
            }
            // Step 4: Generate additional content if requested
            let summary = '';
            let article = '';
            // Map frontend model name to backend AIModel
            const selectedModel = MODEL_MAP[outputOptions.ai_model] || 'gemini-2.5-flash';
            console.log(`[Worker ${workerId}] Using model for AI generation: ${selectedModel} (from: ${outputOptions.ai_model})`);
            if (outputOptions.generate_summary) {
                console.log(`[Worker ${workerId}] Generating summary from transcript using ${selectedModel}...`);
                const summaryResult = await (0, generation_1.generateText)({
                    prompt: `You are an expert content analyst. Analyze the following video transcript and create a comprehensive summary that extracts the key knowledge, insights, and takeaways.

DO NOT just reformat or timestamp the content. Instead:
- Identify the main topics and themes discussed
- Extract key insights, facts, and actionable information
- Organize into clear bullet points grouped by topic
- Include any important quotes or statistics mentioned
- Highlight practical takeaways the viewer should remember

Transcript:
${transcript}

Generate a well-organized summary with clear headings and bullet points:`,
                    model: selectedModel,
                    maxTokens: 4000,
                    temperature: 0.3,
                });
                summary = summaryResult.content;
                console.log(`[Worker ${workerId}] Summary generated: ${summary.length} characters`);
            }
            if (outputOptions.generate_article) {
                console.log(`[Worker ${workerId}] Generating article from transcript using ${selectedModel}...`);
                const articleResult = await (0, generation_1.generateText)({
                    prompt: `You are a professional content writer. Transform the following video transcript into a well-written, engaging article.

DO NOT include timestamps or speaker labels. Instead:
- Create a compelling introduction that hooks the reader
- Organize content into logical sections with clear headings
- Write in a professional but accessible tone
- Expand on key points with context and explanation
- Include a conclusion that summarizes the main takeaways
- Use proper Markdown formatting (## for headings, **bold** for emphasis, etc.)

Transcript:
${transcript}

Write a polished, publication-ready article:`,
                    model: selectedModel,
                    maxTokens: 6000,
                    temperature: 0.5,
                });
                article = articleResult.content;
                console.log(`[Worker ${workerId}] Article generated: ${article.length} characters`);
            }
            // Step 5: Format as Markdown based on selected outputs
            let formattedContent = '';
            if (outputOptions.generate_transcript) {
                formattedContent += `\n\n---\n\n## Video Transcript\n\n${transcript}\n\n`;
            }
            if (summary) {
                formattedContent += `---\n\n## Summary\n\n${summary}\n\n`;
            }
            if (article) {
                formattedContent += `---\n\n## Article\n\n${article}\n\n`;
            }
            // Step 6: Append to document if there's any content to add
            if (formattedContent.trim()) {
                formattedContent += '---\n\n';
                const updatedContent = (document.content || '') + formattedContent;
                // Clear yjs_state to force reload from content on next editor open
                const { error: updateError } = await supabase_1.supabaseAdmin
                    .from('documents')
                    .update({
                    content: updatedContent,
                    yjs_state: null,
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', validated.document_id);
                if (updateError) {
                    throw new Error(`Failed to update document: ${updateError.message}`);
                }
                console.log(`[Worker ${workerId}] Content appended to document ${validated.document_id}`);
            }
            else {
                console.log(`[Worker ${workerId}] No outputs selected - nothing to append`);
            }
            // Step 6: Charge credits
            const currentMonth = new Date().toISOString().slice(0, 7);
            const { error: creditError } = await supabase_1.supabaseAdmin.rpc('deduct_credits', {
                p_tenant_id: job.tenant_id,
                p_credits: validated.credits_to_charge,
                p_month_year: currentMonth,
            });
            if (creditError) {
                console.error(`[Worker ${workerId}] Failed to deduct credits:`, creditError);
            }
            else {
                console.log(`[Worker ${workerId}] Deducted ${validated.credits_to_charge} credits`);
            }
            // Step 7: Log query_usage
            const { error: usageError } = await supabase_1.supabaseAdmin
                .from('query_usage')
                .insert({
                tenant_id: job.tenant_id,
                user_id: validated.user_id,
                query_type: 'video_transcribe_to_document',
                ai_model: validated.output_options?.ai_model || 'gemini',
                tokens_input: 0,
                tokens_output: 0,
                credits_charged: validated.credits_to_charge,
                metadata: {
                    job_id: job.id,
                    document_id: validated.document_id,
                    video_url: validated.video_url,
                    video_type: validated.video_type,
                    transcript_length: transcript.length,
                    transcription_method: 'gemini',
                },
            });
            if (usageError) {
                console.error(`[Worker ${workerId}] Failed to log query usage:`, usageError);
            }
            // Cleanup
            if (gcsUri) {
                await (0, gcs_1.deleteFromGCS)(gcsUri);
            }
            if (localAudioPath && fs.existsSync(localAudioPath)) {
                fs.unlinkSync(localAudioPath);
            }
            const result = {
                document_id: validated.document_id,
                transcript_length: transcript.length,
                credits_charged: validated.credits_to_charge,
                transcription_method: 'gemini',
            };
            await (0, completeJob_1.completeJob)({
                jobId: job.id,
                result,
            });
            console.log(`[Worker ${workerId}] Job ${job.id} completed successfully`);
            return result;
        }
        catch (error) {
            // Cleanup on error
            if (gcsUri) {
                try {
                    await (0, gcs_1.deleteFromGCS)(gcsUri);
                }
                catch (cleanupError) {
                    console.error(`[Worker ${workerId}] Failed to cleanup GCS:`, cleanupError);
                }
            }
            if (localAudioPath && fs.existsSync(localAudioPath)) {
                fs.unlinkSync(localAudioPath);
            }
            throw error;
        }
    }
    catch (error) {
        console.error(`[Worker ${workerId}] Error processing video transcribe to document job:`, error);
        await (0, failJob_1.failJob)({
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorDetails: {
                type: error instanceof Error ? error.constructor.name : 'UnknownError',
                timestamp: new Date().toISOString(),
            },
        });
        throw error;
    }
}
/**
 * Download YouTube audio using sidecar or local yt-dlp
 */
async function downloadYouTubeAudio(videoUrl, outputTemplate, workerId) {
    if (YT_DLP_SIDECAR_URL) {
        console.log(`[Worker ${workerId}] Using yt-dlp sidecar: ${YT_DLP_SIDECAR_URL}`);
        const maxRetries = 5;
        const retryDelaySecs = [3, 5, 10, 15, 20];
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await (0, axios_1.default)({
                    method: 'POST',
                    url: `${YT_DLP_SIDECAR_URL}/download`,
                    data: {
                        url: videoUrl,
                        format: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
                        extract_audio: true,
                    },
                    responseType: 'stream',
                    timeout: 300000,
                });
                const basePath = outputTemplate.replace('.%(ext)s', '');
                const outputPath = `${basePath}.mp3`;
                const writer = fs.createWriteStream(outputPath);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve());
                    writer.on('error', reject);
                });
                return outputPath;
            }
            catch (err) {
                lastError = err;
                const code = err?.code || '';
                const isRetryable = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code);
                if (isRetryable && attempt < maxRetries) {
                    const delay = retryDelaySecs[attempt - 1] || 20;
                    console.log(`[Worker ${workerId}] Sidecar connection failed (${code}), retrying in ${delay}s (attempt ${attempt}/${maxRetries})...`);
                    await new Promise(r => setTimeout(r, delay * 1000));
                }
                else {
                    throw err;
                }
            }
        }
        throw lastError || new Error('Sidecar download failed after retries');
    }
    throw new Error('YT_DLP_SIDECAR_URL not configured - sidecar is required for YouTube downloads');
}
/**
 * Download video from Supabase Storage
 */
async function downloadFromSupabaseStorage(signedUrl, tempDir, fileBase, workerId) {
    console.log(`[Worker ${workerId}] Downloading from Supabase Storage...`);
    const response = await (0, axios_1.default)({
        method: 'GET',
        url: signedUrl,
        responseType: 'stream',
    });
    const outputPath = path.join(tempDir, `${fileBase}.mp4`);
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
    });
    return outputPath;
}
//# sourceMappingURL=videoTranscribeToDocument.js.map