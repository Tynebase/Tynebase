/**
 * RAG Index Worker
 * Processes rag_index jobs from the job queue
 * 
 * Workflow:
 * 1. Get document content from database
 * 2. Run 4-pass semantic chunking algorithm
 * 3. Batch chunks (max 96 per API call for Cohere)
 * 4. Call Cohere Embed v4.0 via AWS Bedrock
 * 5. Insert embeddings into document_embeddings table
 * 6. Update documents.last_indexed_at timestamp
 * 7. Mark job as completed
 */

import { supabaseAdmin } from '../lib/supabase';
import { completeJob } from '../utils/completeJob';
import { failJob } from '../utils/failJob';
import { chunkMarkdownSemanticaly, SemanticChunk } from '../services/rag/chunking';
import { generateEmbeddingsBatch } from '../services/ai/embeddings';
import { z } from 'zod';

const RagIndexPayloadSchema = z.object({
  document_id: z.string().uuid(),
});

type RagIndexPayload = z.infer<typeof RagIndexPayloadSchema>;

interface Job {
  id: string;
  tenant_id: string;
  type: string;
  payload: RagIndexPayload;
  worker_id: string;
}

const INDEXING_TIMEOUT_MS = 120000; // 2 minutes for large documents
const MAX_BATCH_SIZE = 96; // Cohere Embed max batch size

/**
 * Process a RAG index job
 * @param job - Job record from job_queue
 */
export async function processRagIndexJob(job: Job): Promise<void> {
  const workerId = job.worker_id;
  
  console.log(`[Worker ${workerId}] Processing RAG index job ${job.id}`);
  console.log(`[Worker ${workerId}] Document ID: ${job.payload.document_id}`);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('RAG indexing timeout after 2 minutes')), INDEXING_TIMEOUT_MS);
  });

  try {
    const indexingPromise = processIndexing(job, workerId);
    await Promise.race([indexingPromise, timeoutPromise]);
  } catch (error) {
    console.error(`[Worker ${workerId}] RAG indexing failed:`, error);
    await failJob({
      jobId: job.id,
      error: error instanceof Error ? error.message : 'Unknown error during RAG indexing',
    });
  }
}

/**
 * Main indexing logic
 */
async function processIndexing(job: Job, workerId: string): Promise<void> {
  const validated = RagIndexPayloadSchema.parse(job.payload);

  try {
    console.log(`[Worker ${workerId}] Fetching document from database...`);
    
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, title, content, tenant_id')
      .eq('id', validated.document_id)
      .eq('tenant_id', job.tenant_id)
      .single();

    if (docError || !document) {
      throw new Error(`Failed to fetch document: ${docError?.message || 'Document not found'}`);
    }

    if (!document.content || document.content.trim().length === 0) {
      throw new Error('Document has no content to index');
    }

    console.log(`[Worker ${workerId}] Document fetched: "${document.title}" (${document.content.length} chars)`);

    console.log(`[Worker ${workerId}] Running 4-pass semantic chunking...`);
    
    const chunks: SemanticChunk[] = chunkMarkdownSemanticaly(
      document.content,
      document.title
    );

    if (chunks.length === 0) {
      throw new Error('Chunking produced no chunks');
    }

    console.log(`[Worker ${workerId}] Chunking complete: ${chunks.length} chunks created`);

    console.log(`[Worker ${workerId}] Deleting old embeddings for document...`);
    
    const { error: deleteError } = await supabaseAdmin
      .from('document_embeddings')
      .delete()
      .eq('document_id', document.id)
      .eq('tenant_id', job.tenant_id);

    if (deleteError) {
      console.error(`[Worker ${workerId}] Failed to delete old embeddings:`, deleteError);
    }

    console.log(`[Worker ${workerId}] Generating embeddings in batches...`);
    
    const embeddingRecords = [];
    const totalBatches = Math.ceil(chunks.length / MAX_BATCH_SIZE);

    for (let i = 0; i < chunks.length; i += MAX_BATCH_SIZE) {
      const batchNum = Math.floor(i / MAX_BATCH_SIZE) + 1;
      const batchChunks = chunks.slice(i, i + MAX_BATCH_SIZE);
      const batchTexts = batchChunks.map(chunk => chunk.content);

      console.log(`[Worker ${workerId}] Processing batch ${batchNum}/${totalBatches} (${batchTexts.length} chunks)...`);

      try {
        const embeddings = await generateEmbeddingsBatch(batchTexts, 'search_document');

        if (embeddings.length !== batchTexts.length) {
          throw new Error(`Embedding count mismatch: expected ${batchTexts.length}, got ${embeddings.length}`);
        }

        for (let j = 0; j < batchChunks.length; j++) {
          const chunk = batchChunks[j];
          const embedding = embeddings[j];

          embeddingRecords.push({
            document_id: document.id,
            tenant_id: job.tenant_id,
            chunk_index: chunk.index,
            chunk_content: chunk.content,
            embedding: JSON.stringify(embedding),
            metadata: {
              heading: chunk.metadata.heading,
              level: chunk.metadata.level,
              type: chunk.metadata.type,
              tokenCount: chunk.metadata.tokenCount,
              hasContext: chunk.metadata.hasContext,
            },
          });
        }

        console.log(`[Worker ${workerId}] Batch ${batchNum}/${totalBatches} embeddings generated successfully`);

        if (batchNum < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('rate limit')) {
          console.log(`[Worker ${workerId}] Rate limit hit, waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const embeddings = await generateEmbeddingsBatch(batchTexts, 'search_document');

          for (let j = 0; j < batchChunks.length; j++) {
            const chunk = batchChunks[j];
            const embedding = embeddings[j];

            embeddingRecords.push({
              document_id: document.id,
              tenant_id: job.tenant_id,
              chunk_index: chunk.index,
              chunk_content: chunk.content,
              embedding: JSON.stringify(embedding),
              metadata: {
                heading: chunk.metadata.heading,
                level: chunk.metadata.level,
                type: chunk.metadata.type,
                tokenCount: chunk.metadata.tokenCount,
                hasContext: chunk.metadata.hasContext,
              },
            });
          }

          console.log(`[Worker ${workerId}] Batch ${batchNum}/${totalBatches} retry successful`);
        } else {
          throw error;
        }
      }
    }

    console.log(`[Worker ${workerId}] Inserting ${embeddingRecords.length} embeddings into database...`);
    
    const { error: insertError } = await supabaseAdmin
      .from('document_embeddings')
      .insert(embeddingRecords);

    if (insertError) {
      throw new Error(`Failed to insert embeddings: ${insertError.message}`);
    }

    console.log(`[Worker ${workerId}] Updating document last_indexed_at timestamp...`);
    
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({ last_indexed_at: new Date().toISOString() })
      .eq('id', document.id)
      .eq('tenant_id', job.tenant_id);

    if (updateError) {
      console.error(`[Worker ${workerId}] Failed to update last_indexed_at:`, updateError);
    }

    console.log(`[Worker ${workerId}] Completing job...`);
    
    await completeJob({
      jobId: job.id,
      result: {
        document_id: document.id,
        chunks_created: chunks.length,
        embeddings_inserted: embeddingRecords.length,
        indexed_at: new Date().toISOString(),
      },
    });

    console.log(`[Worker ${workerId}] RAG indexing job completed successfully`);

  } catch (error) {
    throw error;
  }
}
