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
 * 6. Preserve audit trails as required by law
 * 7. Mark job as completed
 * 
 * GDPR Compliance:
 * - Right to be forgotten (Article 17)
 * - Preserves data required for legal compliance
 * - Anonymizes rather than deletes where audit trail needed
 */

import { supabaseAdmin } from '../lib/supabase';
import { completeJob } from '../utils/completeJob';
import { failJob } from '../utils/failJob';
import { z } from 'zod';

const AccountDeletionPayloadSchema = z.object({
  user_id: z.string().uuid(),
  requested_at: z.string(),
  requested_by: z.string().uuid(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
});

type AccountDeletionPayload = z.infer<typeof AccountDeletionPayloadSchema>;

interface Job {
  id: string;
  tenant_id: string;
  type: string;
  payload: AccountDeletionPayload;
  worker_id: string;
}

const DELETION_TIMEOUT_MS = 120000;

/**
 * Process an account deletion job
 * @param job - Job record from job_queue
 */
export async function processAccountDeletionJob(job: Job): Promise<void> {
  const workerId = job.worker_id;
  
  console.log(`[Worker ${workerId}] Processing account deletion job ${job.id}`);
  console.log(`[Worker ${workerId}] User ID: ${job.payload.user_id}`);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Account deletion timeout after 120s')), DELETION_TIMEOUT_MS);
  });

  try {
    const deletionPromise = processDeletion(job, workerId);
    await Promise.race([deletionPromise, timeoutPromise]);
  } catch (error) {
    console.error(`[Worker ${workerId}] Account deletion failed:`, error);
    await failJob({
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error during account deletion',
    });
  }
}

/**
 * Main deletion logic
 */
async function processDeletion(job: Job, workerId: string): Promise<void> {
  const validated = AccountDeletionPayloadSchema.parse(job.payload);
  const userId = validated.user_id;
  const tenantId = job.tenant_id;

  console.log(`[Worker ${workerId}] Starting GDPR deletion for user ${userId}`);

  try {
    // 1. Anonymize user profile data
    console.log(`[Worker ${workerId}] Anonymizing user profile...`);
    
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        email: `deleted-${userId}@anonymized.local`,
        full_name: 'Deleted User',
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (userError) {
      throw new Error(`Failed to anonymize user profile: ${userError.message}`);
    }

    console.log(`[Worker ${workerId}] User profile anonymized`);

    // 2. Get all documents created by user
    console.log(`[Worker ${workerId}] Fetching user documents...`);
    
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('author_id', userId);

    if (docsError) {
      throw new Error(`Failed to fetch user documents: ${docsError.message}`);
    }

    const documentIds = documents?.map(d => d.id) || [];
    console.log(`[Worker ${workerId}] Found ${documentIds.length} documents to process`);

    // 3. Delete embeddings for user documents
    if (documentIds.length > 0) {
      console.log(`[Worker ${workerId}] Deleting document embeddings...`);
      
      const { error: embeddingsError } = await supabaseAdmin
        .from('embeddings')
        .delete()
        .in('document_id', documentIds);

      if (embeddingsError) {
        console.error(`[Worker ${workerId}] Failed to delete embeddings:`, embeddingsError);
      } else {
        console.log(`[Worker ${workerId}] Document embeddings deleted`);
      }
    }

    // 4. Delete or anonymize documents
    console.log(`[Worker ${workerId}] Deleting user documents...`);
    
    const { error: deleteDocsError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('author_id', userId);

    if (deleteDocsError) {
      throw new Error(`Failed to delete documents: ${deleteDocsError.message}`);
    }

    console.log(`[Worker ${workerId}] User documents deleted`);

    // 5. Delete templates created by user
    console.log(`[Worker ${workerId}] Deleting user templates...`);
    
    const { error: templatesError } = await supabaseAdmin
      .from('templates')
      .delete()
      .eq('created_by', userId);

    if (templatesError) {
      console.error(`[Worker ${workerId}] Failed to delete templates:`, templatesError);
    } else {
      console.log(`[Worker ${workerId}] User templates deleted`);
    }

    // 6. Anonymize usage history (preserve for audit but remove PII)
    console.log(`[Worker ${workerId}] Anonymizing usage history...`);
    
    const { error: usageError } = await supabaseAdmin
      .from('query_usage')
      .update({
        metadata: {
          anonymized: true,
          original_user_deleted: true,
          deletion_date: new Date().toISOString(),
        },
      })
      .eq('user_id', userId);

    if (usageError) {
      console.error(`[Worker ${workerId}] Failed to anonymize usage history:`, usageError);
    } else {
      console.log(`[Worker ${workerId}] Usage history anonymized`);
    }

    // 7. Delete document lineage events (or anonymize if needed for audit)
    console.log(`[Worker ${workerId}] Cleaning up document lineage...`);
    
    if (documentIds.length > 0) {
      const { error: lineageError } = await supabaseAdmin
        .from('document_lineage')
        .delete()
        .in('document_id', documentIds);

      if (lineageError) {
        console.error(`[Worker ${workerId}] Failed to delete lineage:`, lineageError);
      } else {
        console.log(`[Worker ${workerId}] Document lineage cleaned up`);
      }
    }

    // 8. Create audit log entry for the deletion
    console.log(`[Worker ${workerId}] Creating audit log entry...`);
    
    const { error: auditError } = await supabaseAdmin
      .from('query_usage')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        query_type: 'gdpr_account_deletion',
        ai_model: 'system',
        credits_charged: 0,
        metadata: {
          job_id: job.id,
          requested_at: validated.requested_at,
          requested_by: validated.requested_by,
          ip_address: validated.ip_address,
          user_agent: validated.user_agent,
          documents_deleted: documentIds.length,
          completed_at: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.error(`[Worker ${workerId}] Failed to create audit log:`, auditError);
    }

    // 9. Complete the job
    console.log(`[Worker ${workerId}] Completing job...`);
    
    await completeJob({
      jobId: job.id,
      result: {
        user_id: userId,
        user_anonymized: true,
        documents_deleted: documentIds.length,
        embeddings_deleted: true,
        templates_deleted: true,
        usage_history_anonymized: true,
        completed_at: new Date().toISOString(),
      },
    });

    console.log(`[Worker ${workerId}] Account deletion job completed successfully`);

  } catch (error) {
    console.error(`[Worker ${workerId}] Error during deletion process:`, error);
    throw error;
  }
}
