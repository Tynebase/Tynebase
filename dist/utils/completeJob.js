"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeJob = void 0;
const supabase_1 = require("../lib/supabase");
const zod_1 = require("zod");
const CompleteJobSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid('Invalid job ID format'),
    result: zod_1.z.record(zod_1.z.unknown()).default({})
});
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
const completeJob = async (params) => {
    try {
        const validated = CompleteJobSchema.parse(params);
        const sanitizedResult = sanitizeResult(validated.result);
        const { data, error } = await supabase_1.supabaseAdmin
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
        return data;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            console.error('[completeJob] Validation error:', errorMessages);
            throw new Error(`Invalid job completion parameters: ${errorMessages}`);
        }
        throw error;
    }
};
exports.completeJob = completeJob;
/**
 * Sanitizes job result to prevent storing sensitive data
 *
 * @param result - Raw result object
 * @returns Sanitized result
 */
const sanitizeResult = (result) => {
    const sanitized = {};
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
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizeResult(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};
//# sourceMappingURL=completeJob.js.map