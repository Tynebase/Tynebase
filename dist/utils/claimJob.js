"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimJob = void 0;
const supabase_1 = require("../lib/supabase");
/**
 * Atomically claims a pending job from the queue using FOR UPDATE SKIP LOCKED
 * This prevents race conditions when multiple workers are running
 *
 * @param workerId - Unique identifier for this worker instance
 * @returns Claimed job or null if no jobs available
 */
const claimJob = async (workerId) => {
    try {
        const { data, error } = await supabase_1.supabaseAdmin.rpc('claim_job', {
            p_worker_id: workerId
        });
        if (error) {
            throw error;
        }
        if (!data || data.length === 0) {
            return null;
        }
        return data[0];
    }
    catch (error) {
        console.error(`[claimJob] Error claiming job:`, error);
        throw error;
    }
};
exports.claimJob = claimJob;
//# sourceMappingURL=claimJob.js.map