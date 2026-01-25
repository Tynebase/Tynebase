import { supabaseAdmin } from '../lib/supabase';
import { z } from 'zod';

const JobTypeSchema = z.enum([
  'ai_generation',
  'video_ingestion',
  'document_indexing',
  'document_export',
  'tenant_cleanup',
  'test_job'
]);

const DispatchJobSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID format'),
  type: JobTypeSchema,
  payload: z.record(z.unknown()).default({})
});

export type JobType = z.infer<typeof JobTypeSchema>;

export interface DispatchJobParams {
  tenantId: string;
  type: JobType;
  payload?: Record<string, any>;
}

export interface DispatchedJob {
  id: string;
  tenant_id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, any>;
  created_at: string;
}

/**
 * Dispatches a job to the job queue for asynchronous processing
 * 
 * @param params - Job parameters including tenant ID, type, and payload
 * @returns The created job record
 * @throws Error if validation fails or database insert fails
 * 
 * @example
 * ```typescript
 * const job = await dispatchJob({
 *   tenantId: '123e4567-e89b-12d3-a456-426614174000',
 *   type: 'ai_generation',
 *   payload: { prompt: 'Generate a summary', model: 'gpt-4' }
 * });
 * ```
 */
export const dispatchJob = async (params: DispatchJobParams): Promise<DispatchedJob> => {
  try {
    const validated = DispatchJobSchema.parse(params);

    const sanitizedPayload = sanitizePayload(validated.payload);

    const { data, error } = await supabaseAdmin
      .from('job_queue')
      .insert({
        tenant_id: validated.tenantId,
        type: validated.type,
        status: 'pending',
        payload: sanitizedPayload
      })
      .select()
      .single();

    if (error) {
      console.error('[dispatchJob] Database error:', error);
      throw new Error(`Failed to dispatch job: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to dispatch job: No data returned');
    }

    console.log(`[dispatchJob] Job dispatched: ${data.id} (type: ${data.type}, tenant: ${data.tenant_id})`);

    return data as DispatchedJob;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('[dispatchJob] Validation error:', errorMessages);
      throw new Error(`Invalid job parameters: ${errorMessages}`);
    }
    throw error;
  }
};

/**
 * Sanitizes job payload to prevent injection attacks and remove sensitive data
 * 
 * @param payload - Raw payload object
 * @returns Sanitized payload
 */
const sanitizePayload = (payload: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('secret') || 
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('api_key') ||
        key.toLowerCase().includes('apikey')) {
      console.warn(`[dispatchJob] Skipping sensitive field: ${key}`);
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};
