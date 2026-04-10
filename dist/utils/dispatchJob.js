"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchJob = void 0;
const supabase_1 = require("../lib/supabase");
const zod_1 = require("zod");
const JobTypeSchema = zod_1.z.enum([
    'ai_generation',
    'video_ingestion',
    'video_ingest',
    'video_ingest_youtube',
    'video_ingest_url',
    'video_transcribe_to_document',
    'audio_ingestion',
    'audio_ingest',
    'document_indexing',
    'document_export',
    'document_convert',
    'legal_document_process',
    'tenant_cleanup',
    'test_job',
    'rag_index',
    'gdpr_delete'
]);
const DispatchJobSchema = zod_1.z.object({
    tenantId: zod_1.z.string().uuid('Invalid tenant ID format'),
    type: JobTypeSchema,
    payload: zod_1.z.record(zod_1.z.unknown()).default({})
});
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
const dispatchJob = async (params) => {
    try {
        const validated = DispatchJobSchema.parse(params);
        const sanitizedPayload = sanitizePayload(validated.payload);
        const { data, error } = await supabase_1.supabaseAdmin
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
        return data;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            console.error('[dispatchJob] Validation error:', errorMessages);
            throw new Error(`Invalid job parameters: ${errorMessages}`);
        }
        throw error;
    }
};
exports.dispatchJob = dispatchJob;
/**
 * Sanitizes job payload to prevent injection attacks and remove sensitive data
 *
 * @param payload - Raw payload object
 * @returns Sanitized payload
 */
const sanitizePayload = (payload) => {
    const sanitized = {};
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
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizePayload(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};
//# sourceMappingURL=dispatchJob.js.map