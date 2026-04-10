"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestDocument = ingestDocument;
exports.ingestDocumentsBatch = ingestDocumentsBatch;
exports.reIngestTenantDocuments = reIngestTenantDocuments;
const supabase_1 = require("../../lib/supabase");
const embeddings_1 = require("../ai/embeddings");
const chunking_1 = require("./chunking");
/**
 * Batch configuration
 */
const MAX_BATCH_SIZE = 96; // Cohere's max batch size
/**
 * Ingests a document by chunking and generating embeddings
 *
 * @param documentId - UUID of the document to ingest
 * @param tenantId - UUID of the tenant
 * @param content - Document content to ingest
 * @param metadata - Optional metadata to attach to chunks
 * @returns Ingestion result with statistics
 */
async function ingestDocument(documentId, tenantId, content, metadata) {
    try {
        // Step 1: Delete existing embeddings for this document
        const { error: deleteError } = await supabase_1.supabaseAdmin
            .from('document_embeddings')
            .delete()
            .eq('document_id', documentId)
            .eq('tenant_id', tenantId);
        if (deleteError) {
            throw new Error(`Failed to delete existing embeddings: ${deleteError.message}`);
        }
        // Step 2: Chunk the document content using semantic chunking
        const semanticChunks = (0, chunking_1.chunkMarkdownSemanticaly)(content, metadata?.title || '');
        if (semanticChunks.length === 0) {
            return {
                documentId,
                chunksCreated: 0,
                embeddingsGenerated: 0,
                success: true,
            };
        }
        // Validate chunks
        const validation = (0, chunking_1.validateChunks)(semanticChunks);
        if (!validation.valid) {
            throw new Error(`Chunk validation failed: ${validation.issues.join(', ')}`);
        }
        // Get chunking statistics for logging
        const stats = (0, chunking_1.getChunkingStats)(semanticChunks);
        console.log('Chunking stats:', stats);
        // Extract chunk content for embedding
        const chunks = semanticChunks.map(c => c.content);
        // Step 3: Generate embeddings in batches
        const allEmbeddings = [];
        for (let i = 0; i < chunks.length; i += MAX_BATCH_SIZE) {
            const batchChunks = chunks.slice(i, i + MAX_BATCH_SIZE);
            const batchEmbeddings = await (0, embeddings_1.generateEmbeddingsBatch)(batchChunks, 'search_document');
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
        const { error: insertError } = await supabase_1.supabaseAdmin
            .from('document_embeddings')
            .insert(embeddingRecords);
        if (insertError) {
            throw new Error(`Failed to insert embeddings: ${insertError.message}`);
        }
        // Use atomic RPC to set last_indexed_at = GREATEST(NOW(), updated_at) on the DB,
        // guaranteeing last_indexed_at >= updated_at regardless of clock skew or triggers.
        const { error: updateError } = await supabase_1.supabaseAdmin
            .rpc('mark_document_indexed', { doc_id: documentId, t_id: tenantId });
        if (updateError) {
            console.error(`[ingestDocument] Failed to update last_indexed_at:`, updateError);
        }
        return {
            documentId,
            chunksCreated: chunks.length,
            embeddingsGenerated: allEmbeddings.length,
            success: true,
        };
    }
    catch (error) {
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
async function ingestDocumentsBatch(documents) {
    const results = [];
    for (const doc of documents) {
        const result = await ingestDocument(doc.documentId, doc.tenantId, doc.content, doc.metadata);
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
async function reIngestTenantDocuments(tenantId) {
    // Fetch all published documents for the tenant
    const { data: documents, error: fetchError } = await supabase_1.supabaseAdmin
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
    const results = [];
    for (const doc of documents) {
        const result = await ingestDocument(doc.id, tenantId, doc.content || '', { title: doc.title });
        results.push(result);
    }
    return results;
}
//# sourceMappingURL=ingestion.js.map