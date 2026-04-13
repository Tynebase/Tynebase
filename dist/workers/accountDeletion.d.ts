/**
 * Account Deletion Worker
 * Processes gdpr_delete jobs from the job queue
 *
 * Workflow:
 * 1. Anonymize user profile data
 * 2. Delete or anonymize user documents
 * 3. Delete embeddings associated with user documents
 * 4. Anonymize usage history (preserve for audit but remove PII)
 * 5. Delete templates created by user
 * 6. Delete DM messages from the user
 * 7. Remove user from DM participants and clean up empty conversations
 * 8. Delete DM reactions from the user
 * 9. Delete regular chat messages from the user
 * 10. Delete chat reactions from the user
 * 11. Delete chat read receipts for the user
 * 12. Preserve audit trails as required by law
 * 13. Mark job as completed
 *
 * GDPR Compliance:
 * - Right to be forgotten (Article 17)
 * - Preserves data required for legal compliance
 * - Anonymizes rather than deletes where audit trail needed
 */
import { z } from 'zod';
declare const AccountDeletionPayloadSchema: z.ZodObject<{
    user_id: z.ZodString;
    requested_at: z.ZodString;
    requested_by: z.ZodString;
    ip_address: z.ZodOptional<z.ZodString>;
    user_agent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    requested_by: string;
    requested_at: string;
    ip_address?: string | undefined;
    user_agent?: string | undefined;
}, {
    user_id: string;
    requested_by: string;
    requested_at: string;
    ip_address?: string | undefined;
    user_agent?: string | undefined;
}>;
type AccountDeletionPayload = z.infer<typeof AccountDeletionPayloadSchema>;
interface Job {
    id: string;
    tenant_id: string;
    type: string;
    payload: AccountDeletionPayload;
    worker_id: string;
}
/**
 * Process an account deletion job
 * @param job - Job record from job_queue
 */
export declare function processAccountDeletionJob(job: Job): Promise<void>;
export {};
//# sourceMappingURL=accountDeletion.d.ts.map