"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.failJob = void 0;
const supabase_1 = require("../lib/supabase");
const zod_1 = require("zod");
const FailJobSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid('Invalid job ID format'),
    error: zod_1.z.string().min(1, 'Error message is required'),
    errorDetails: zod_1.z.record(zod_1.z.unknown()).optional()
});
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MINUTES = 5;
/**
 * Marks a job as failed, increments attempts, and optionally schedules retry
 *
 * @param params - Job ID, error message, and optional error details
 * @returns The updated job record
 * @throws Error if validation fails or database update fails
 *
 * @example
 * ```typescript
 * const failedJob = await failJob({
 *   jobId: '123e4567-e89b-12d3-a456-426614174000',
 *   error: 'API timeout',
 *   errorDetails: { statusCode: 504, provider: 'openai' }
 * });
 * ```
 */
const failJob = async (params) => {
    try {
        const validated = FailJobSchema.parse(params);
        const { data: currentJob, error: fetchError } = await supabase_1.supabaseAdmin
            .from('job_queue')
            .select('attempts')
            .eq('id', validated.jobId)
            .single();
        if (fetchError) {
            console.error('[failJob] Error fetching job:', fetchError);
            throw new Error(`Failed to fetch job: ${fetchError.message}`);
        }
        if (!currentJob) {
            throw new Error('Failed to fail job: Job not found');
        }
        const newAttempts = currentJob.attempts + 1;
        const shouldRetry = newAttempts < MAX_RETRY_ATTEMPTS;
        const sanitizedErrorDetails = validated.errorDetails
            ? sanitizeErrorDetails(validated.errorDetails)
            : {};
        const errorResult = {
            error: validated.error,
            errorDetails: sanitizedErrorDetails,
            timestamp: new Date().toISOString(),
            attempts: newAttempts
        };
        const updateData = {
            status: 'failed',
            result: errorResult,
            attempts: newAttempts
        };
        if (shouldRetry) {
            const nextRetryAt = new Date();
            nextRetryAt.setMinutes(nextRetryAt.getMinutes() + RETRY_DELAY_MINUTES);
            updateData.next_retry_at = nextRetryAt.toISOString();
            updateData.status = 'pending';
            updateData.worker_id = null;
            console.log(`[failJob] Job ${validated.jobId} will retry (attempt ${newAttempts}/${MAX_RETRY_ATTEMPTS}) at ${nextRetryAt.toISOString()}`);
        }
        else {
            updateData.completed_at = new Date().toISOString();
            console.log(`[failJob] Job ${validated.jobId} permanently failed after ${newAttempts} attempts`);
        }
        const { data, error } = await supabase_1.supabaseAdmin
            .from('job_queue')
            .update(updateData)
            .eq('id', validated.jobId)
            .select()
            .single();
        if (error) {
            console.error('[failJob] Database error:', error);
            throw new Error(`Failed to update job: ${error.message}`);
        }
        if (!data) {
            throw new Error('Failed to fail job: No data returned');
        }
        console.log(`[failJob] Job failed: ${data.id} (type: ${data.type}, tenant: ${data.tenant_id}, error: ${validated.error})`);
        return data;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            console.error('[failJob] Validation error:', errorMessages);
            throw new Error(`Invalid job failure parameters: ${errorMessages}`);
        }
        throw error;
    }
};
exports.failJob = failJob;
/**
 * Sanitizes error details to prevent storing sensitive data
 * Removes stack traces and internal error details that could expose system information
 *
 * @param errorDetails - Raw error details object
 * @returns Sanitized error details
 */
const sanitizeErrorDetails = (errorDetails) => {
    const sanitized = {};
    for (const [key, value] of Object.entries(errorDetails)) {
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('api_key') ||
            key.toLowerCase().includes('apikey') ||
            key.toLowerCase().includes('credential')) {
            console.warn(`[failJob] Skipping sensitive field in error details: ${key}`);
            continue;
        }
        if (key.toLowerCase() === 'stack' || key.toLowerCase() === 'stacktrace') {
            console.warn(`[failJob] Removing stack trace from error details`);
            continue;
        }
        if (typeof value === 'string') {
            sanitized[key] = value.trim();
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizeErrorDetails(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};
//# sourceMappingURL=failJob.js.map