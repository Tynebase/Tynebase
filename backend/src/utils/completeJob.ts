import { supabaseAdmin } from '../lib/supabase';
import { z } from 'zod';

const CompleteJobSchema = z.object({
  jobId: z.string().uuid('Invalid job ID format'),
  result: z.record(z.unknown()).default({})
});

export interface CompleteJobParams {
  jobId: string;
  result?: Record<string, any>;
}

export interface CompletedJob {
  id: string;
  tenant_id: string;
  type: string;
  status: 'completed';
  payload: Record<string, any>;
  result: Record<string, any>;
  worker_id: string | null;
  attempts: number;
  created_at: string;
  completed_at: string;
}

/**
 * Marks a job as completed and stores the result
 * 
 * @param params - Job ID and optional result data
 * @returns The updated job record
 * @throws Error if validation fails or database update fails
 * 
 * @example
 * ```typescript
 * const completedJob = await completeJob({
 *   jobId: '123e4567-e89b-12d3-a456-426614174000',
 *   result: { output: 'Generated content', tokens: 1500 }
 * });
 * ```
 */
export const completeJob = async (params: CompleteJobParams): Promise<CompletedJob> => {
  try {
    const validated = CompleteJobSchema.parse(params);

    const sanitizedResult = sanitizeResult(validated.result);

    const { data, error } = await supabaseAdmin
      .from('job_queue')
      .update({
        status: 'completed',
        result: sanitizedResult,
        completed_at: new Date().toISOString()
      })
      .eq('id', validated.jobId)
      .select()
      .single();

    if (error) {
      console.error('[completeJob] Database error:', error);
      throw new Error(`Failed to complete job: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to complete job: Job not found');
    }

    console.log(`[completeJob] Job completed: ${data.id} (type: ${data.type}, tenant: ${data.tenant_id})`);

    return data as CompletedJob;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('[completeJob] Validation error:', errorMessages);
      throw new Error(`Invalid job completion parameters: ${errorMessages}`);
    }
    throw error;
  }
};

/**
 * Sanitizes job result to prevent storing sensitive data
 * 
 * @param result - Raw result object
 * @returns Sanitized result
 */
const sanitizeResult = (result: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(result)) {
    if (key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('secret') || 
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('api_key') ||
        key.toLowerCase().includes('apikey') ||
        key.toLowerCase().includes('credential')) {
      console.warn(`[completeJob] Skipping sensitive field in result: ${key}`);
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeResult(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};
