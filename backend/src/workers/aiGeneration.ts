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
import { generateText } from '../services/ai/openai';
import { generateText as generateTextAnthropic } from '../services/ai/anthropic';
import { generateText as generateTextVertex } from '../services/ai/vertex';
import { completeJob } from '../utils/completeJob';
import { failJob } from '../utils/failJob';
import { AIModel } from '../services/ai/types';
import { z } from 'zod';

const AIGenerationPayloadSchema = z.object({
  prompt: z.string().min(1),
  model: z.enum(['gpt-5.2', 'claude-sonnet-4.5', 'claude-opus-4.5', 'gemini-3-flash']),
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

    const sanitizedContent = sanitizeAIOutput(generatedContent.content);

    const documentTitle = generateDocumentTitle(validated.prompt, sanitizedContent);

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
        model: validated.model,
        input_tokens: generatedContent.tokensInput,
        output_tokens: generatedContent.tokensOutput,
        credits_used: validated.estimated_credits,
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
async function callAIProvider(
  prompt: string,
  model: AIModel,
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

  if (model.startsWith('gpt-')) {
    const result = await Promise.race([
      generateText({ prompt, model: model as AIModel, maxTokens }),
      timeoutPromise,
    ]);
    return result;
  } else if (model.startsWith('claude-')) {
    const result = await Promise.race([
      generateTextAnthropic({ prompt, model: model as AIModel, maxTokens }),
      timeoutPromise,
    ]);
    return result;
  } else if (model.startsWith('gemini-')) {
    const result = await Promise.race([
      generateTextVertex({ prompt, model: model as AIModel, maxTokens }),
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
