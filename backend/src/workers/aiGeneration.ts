/**
 * AI Generation Worker
 * Processes ai_generation jobs from the job queue
 * 
 * Workflow:
 * 1. Extract job payload (prompt, model, user_id, etc.)
 * 2. Call AI provider based on model selection
 * 3. Generate full content
 * 4. Create document with status: draft
 * 5. Create lineage event (type: ai_generated)
 * 6. Log query_usage with actual tokens
 * 7. Mark job as completed with document_id
 */

import { supabaseAdmin } from '../lib/supabase';
import { generateText } from '../services/ai/bedrock';
import { generateText as generateTextAnthropic } from '../services/ai/anthropic';
import { generateText as generateTextVertex } from '../services/ai/vertex';
import { completeJob } from '../utils/completeJob';
import { failJob } from '../utils/failJob';
import { AIModel } from '../services/ai/types';
import { z } from 'zod';

const AIGenerationPayloadSchema = z.object({
  prompt: z.string().min(1),
  model: z.enum(['deepseek', 'claude', 'gemini']),
  max_tokens: z.number().int().positive().optional(),
  user_id: z.string().uuid(),
  estimated_credits: z.number().int().positive(),
});

type AIGenerationPayload = z.infer<typeof AIGenerationPayloadSchema>;

interface Job {
  id: string;
  tenant_id: string;
  type: string;
  payload: AIGenerationPayload;
  worker_id: string;
}

/**
 * Process an AI generation job
 * @param job - Job record from job_queue
 */
export async function processAIGenerationJob(job: Job): Promise<void> {
  const workerId = job.worker_id;
  
  console.log(`[Worker ${workerId}] Processing AI generation job ${job.id}`);
  console.log(`[Worker ${workerId}] Tenant: ${job.tenant_id}, Model: ${job.payload.model}`);

  try {
    const validated = AIGenerationPayloadSchema.parse(job.payload);

    const generatedContent = await callAIProvider(
      validated.prompt,
      validated.model,
      validated.max_tokens || 2000
    );

    console.log(`[Worker ${workerId}] AI generation completed. Content length: ${generatedContent.content?.length || 0}`);

    const sanitizedContent = sanitizeAIOutput(generatedContent.content);
    
    console.log(`[Worker ${workerId}] Content sanitized. Length: ${sanitizedContent.length}`);

    const documentTitle = generateDocumentTitle(validated.prompt, sanitizedContent);

    // NOTE: We intentionally do NOT save yjs_state here.
    // The collab server will initialize the Y.js document from the markdown content
    // using initializeYdocFromContent() which properly parses markdown into TipTap nodes
    // (headings, lists, blockquotes, etc.) for beautiful rich text rendering.

    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        tenant_id: job.tenant_id,
        title: documentTitle,
        content: sanitizedContent,
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
        event_type: 'ai_generated',
        actor_id: validated.user_id,
        metadata: {
          model: validated.model,
          provider: generatedContent.provider,
          prompt_length: validated.prompt.length,
          output_length: sanitizedContent.length,
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
        query_type: 'text_generation',
        ai_model: validated.model,
        tokens_input: generatedContent.tokensInput,
        tokens_output: generatedContent.tokensOutput,
        credits_charged: validated.estimated_credits,
        month_year: currentMonth,
        metadata: {
          job_id: job.id,
          document_id: document.id,
        },
      });

    if (usageError) {
      console.error(`[Worker ${workerId}] Failed to log query usage:`, usageError);
    } else {
      console.log(`[Worker ${workerId}] Query usage logged: ${generatedContent.tokensInput + generatedContent.tokensOutput} tokens`);
    }

    await completeJob({
      jobId: job.id,
      result: {
        document_id: document.id,
        title: document.title,
        content: sanitizedContent,
        tokens_input: generatedContent.tokensInput,
        tokens_output: generatedContent.tokensOutput,
        model: generatedContent.model,
        provider: generatedContent.provider,
      },
    });

    console.log(`[Worker ${workerId}] Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`[Worker ${workerId}] Error processing AI generation job:`, error);

    await failJob({
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: {
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Call the appropriate AI provider based on model
 * @param prompt - User prompt
 * @param model - AI model name
 * @param maxTokens - Maximum tokens to generate
 * @returns Generated content with token counts
 */
/**
 * System prompt for document generation.
 * Instructs the AI to produce complete document content directly,
 * rather than engaging in conversational back-and-forth.
 */
const DOCUMENT_GENERATION_SYSTEM_PROMPT = `You are a professional document writer. Your task is to generate complete, well-structured document content based on the user's request.

CRITICAL RULES:
- Generate the requested document content IMMEDIATELY and IN FULL. Do NOT ask clarifying questions, do NOT engage in conversation, and do NOT request more information.
- Write the document as if you are the author, not an assistant having a chat.
- Use Markdown formatting: headings (#, ##, ###), bullet points, numbered lists, bold, italic, etc.
- Make reasonable assumptions where details are not provided. Fill in professional, realistic placeholder content rather than asking the user.
- The output should be a complete, ready-to-use document — not a conversation or a list of questions.
- Do NOT include meta-commentary like "Here is your document" or "I'd be happy to help". Just output the document content directly.`;

async function callAIProvider(
  prompt: string,
  model: 'deepseek' | 'claude' | 'gemini',
  maxTokens: number
): Promise<{
  content: string;
  model: AIModel;
  tokensInput: number;
  tokensOutput: number;
  provider: string;
}> {
  const timeout = 60000;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('AI generation timed out after 60 seconds')), timeout);
  });

  // Map simplified model names to actual model IDs
  const modelMap: Record<string, AIModel> = {
    'deepseek': 'deepseek-v3',
    'claude': 'claude-sonnet-4.5',
    'gemini': 'gemini-2.5-flash',
  };

  const actualModel = modelMap[model];
  if (!actualModel) {
    throw new Error(`Unsupported model: ${model}`);
  }

  const requestBase = {
    prompt,
    model: actualModel,
    maxTokens,
    systemPrompt: DOCUMENT_GENERATION_SYSTEM_PROMPT,
  };

  // Route to appropriate provider based on model
  if (model === 'deepseek') {
    // DeepSeek via AWS Bedrock
    const result = await Promise.race([
      generateText(requestBase),
      timeoutPromise,
    ]);
    return result;
  } else if (model === 'claude') {
    // Claude via AWS Bedrock (Anthropic service)
    const result = await Promise.race([
      generateTextAnthropic(requestBase),
      timeoutPromise,
    ]);
    return result;
  } else if (model === 'gemini') {
    // Gemini 2.0 via Google Vertex AI
    const result = await Promise.race([
      generateTextVertex(requestBase),
      timeoutPromise,
    ]);
    return result;
  } else {
    throw new Error(`Unsupported model: ${model}`);
  }
}

/**
 * Sanitize AI output to prevent XSS and injection attacks
 * @param content - Raw AI-generated content
 * @returns Sanitized content
 */
function sanitizeAIOutput(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let sanitized = content.trim();

  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  if (sanitized.length > 100000) {
    sanitized = sanitized.substring(0, 100000);
    console.warn('[sanitizeAIOutput] Content truncated to 100,000 characters');
  }

  return sanitized;
}

/**
 * Generate a document title from the prompt and content
 * @param prompt - Original user prompt
 * @param content - Generated content
 * @returns Document title (max 100 chars)
 */
function generateDocumentTitle(prompt: string, content: string): string {
  const firstLine = content.split('\n')[0]?.trim() || '';
  
  if (firstLine.startsWith('#')) {
    const title = firstLine.replace(/^#+\s*/, '').trim();
    if (title.length > 0 && title.length <= 100) {
      return title;
    }
  }

  const promptTitle = prompt.length <= 80 
    ? prompt 
    : prompt.substring(0, 77) + '...';

  return `AI Generated: ${promptTitle}`;
}
