/**
 * Document Ingestion Service for RAG Pipeline
 * Handles document chunking and embedding generation using Cohere Embed v4.0
 * 
 * Features:
 * - Smart text chunking with overlap
 * - Batch embedding generation
 * - Tenant isolation
 * - Progress tracking
 */

import { supabaseAdmin } from '../../lib/supabase';
import { generateEmbeddingsBatch } from '../ai/embeddings';
import { chunkMarkdownSemanticaly, getChunkingStats, validateChunks } from './chunking';

/**
 * Batch configuration
 */
const MAX_BATCH_SIZE = 96; // Cohere's max batch size

/**
 * Ingestion result interface
 */
export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  embeddingsGenerated: number;
  success: boolean;
  error?: string;
}


/**
 * Ingests a document by chunking and generating embeddings
 * 
 * @param documentId - UUID of the document to ingest
 * @param tenantId - UUID of the tenant
 * @param content - Document content to ingest
 * @param metadata - Optional metadata to attach to chunks
 * @returns Ingestion result with statistics
 */
export async function ingestDocument(
  documentId: string,
  tenantId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<IngestionResult> {
  try {
    // Step 1: Delete existing embeddings for this document
    const { error: deleteError } = await supabaseAdmin
      .from('document_embeddings')
      .delete()
      .eq('document_id', documentId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      throw new Error(`Failed to delete existing embeddings: ${deleteError.message}`);
    }

    // Step 2: Chunk the document content using semantic chunking
    const semanticChunks = chunkMarkdownSemanticaly(content, metadata?.title || '');

    if (semanticChunks.length === 0) {
      return {
        documentId,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        success: true,
      };
    }

    // Validate chunks
    const validation = validateChunks(semanticChunks);
    if (!validation.valid) {
      throw new Error(`Chunk validation failed: ${validation.issues.join(', ')}`);
    }

    // Get chunking statistics for logging
    const stats = getChunkingStats(semanticChunks);
    console.log('Chunking stats:', stats);

    // Extract chunk content for embedding
    const chunks = semanticChunks.map(c => c.content);

    // Step 3: Generate embeddings in batches
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < chunks.length; i += MAX_BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + MAX_BATCH_SIZE);
      const batchEmbeddings = await generateEmbeddingsBatch(batchChunks, 'search_document');
      allEmbeddings.push(...batchEmbeddings);
    }

    // Step 4: Insert chunks with embeddings into database
    const embeddingRecords = semanticChunks.map((chunk, index) => ({
      document_id: documentId,
      tenant_id: tenantId,
      chunk_index: chunk.index,
      chunk_content: chunk.content,
      embedding: allEmbeddings[index],
      metadata: {
        ...metadata,
        ...chunk.metadata,
      },
    }));

    const { error: insertError } = await supabaseAdmin
      .from('document_embeddings')
      .insert(embeddingRecords);

    if (insertError) {
      throw new Error(`Failed to insert embeddings: ${insertError.message}`);
    }

    return {
      documentId,
      chunksCreated: chunks.length,
      embeddingsGenerated: allEmbeddings.length,
      success: true,
    };
  } catch (error: any) {
    return {
      documentId,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      success: false,
      error: error.message || 'Unknown error during ingestion',
    };
  }
}

/**
 * Batch ingests multiple documents
 * Processes documents sequentially to avoid rate limits
 * 
 * @param documents - Array of documents to ingest
 * @returns Array of ingestion results
 */
export async function ingestDocumentsBatch(
  documents: Array<{
    documentId: string;
    tenantId: string;
    content: string;
    metadata?: Record<string, any>;
  }>
): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  for (const doc of documents) {
    const result = await ingestDocument(
      doc.documentId,
      doc.tenantId,
      doc.content,
      doc.metadata
    );
    results.push(result);
  }

  return results;
}

/**
 * Re-ingests all documents for a tenant
 * Useful after embedding model changes
 * 
 * @param tenantId - UUID of the tenant
 * @returns Array of ingestion results
 */
export async function reIngestTenantDocuments(tenantId: string): Promise<IngestionResult[]> {
  // Fetch all published documents for the tenant
  const { data: documents, error: fetchError } = await supabaseAdmin
    .from('documents')
    .select('id, content, title')
    .eq('tenant_id', tenantId)
    .eq('status', 'published');

  if (fetchError) {
    throw new Error(`Failed to fetch documents: ${fetchError.message}`);
  }

  if (!documents || documents.length === 0) {
    return [];
  }

  // Ingest each document
  const results: IngestionResult[] = [];
  
  for (const doc of documents) {
    const result = await ingestDocument(
      doc.id,
      tenantId,
      doc.content || '',
      { title: doc.title }
    );
    results.push(result);
  }

  return results;
}
