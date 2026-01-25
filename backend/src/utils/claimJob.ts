import { supabaseAdmin } from '../lib/supabase';

/**
 * Job interface matching the job_queue table schema
 */
export interface Job {
  id: string;
  tenant_id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, any>;
  result: Record<string, any>;
  worker_id: string | null;
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Atomically claims a pending job from the queue using FOR UPDATE SKIP LOCKED
 * This prevents race conditions when multiple workers are running
 * 
 * @param workerId - Unique identifier for this worker instance
 * @returns Claimed job or null if no jobs available
 */
export const claimJob = async (workerId: string): Promise<Job | null> => {
  try {
    const { data, error } = await supabaseAdmin.rpc('claim_job', {
      p_worker_id: workerId
    });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as Job;
  } catch (error) {
    console.error(`[claimJob] Error claiming job:`, error);
    throw error;
  }
};
