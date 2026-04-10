"use strict";
/**
 * RAG Search Service
 * Handles semantic search with hybrid search and Cohere reranking
 *
 * Features:
 * - Hybrid search (vector + full-text)
 * - Cohere Rerank v3.5 for improved relevance
 * - Tenant isolation
 * - Configurable result limits
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchDocuments = searchDocuments;
exports.findSimilarChunks = findSimilarChunks;
exports.getEmbeddingStats = getEmbeddingStats;
const supabase_1 = require("../../lib/supabase");
const embeddings_1 = require("../ai/embeddings");
const embeddings_2 = require("../ai/embeddings");
/**
 * Performs hybrid search on document embeddings
 * Combines vector similarity search with full-text search
 *
 * @param options - Search options
 * @returns Array of search results
 */
async function searchDocuments(options) {
    const { tenantId, query, limit = 50, useReranking = true, rerankTopN = 10, } = options;
    try {
        // Step 1: Generate query embedding
        const queryEmbedding = await (0, embeddings_1.generateEmbedding)(query, 'search_query');
        // Step 2: Perform hybrid search using database function
        const { data: results, error: searchError } = await supabase_1.supabaseAdmin
            .rpc('hybrid_search', {
            query_embedding: queryEmbedding,
            query_text: query,
            p_tenant_id: tenantId,
            match_count: limit,
        });
        if (searchError) {
            throw new Error(`Hybrid search failed: ${searchError.message}`);
        }
        if (!results || results.length === 0) {
            return [];
        }
        // Step 3: Map results to SearchResult interface
        let searchResults = results.map((result) => ({
            id: result.id,
            documentId: result.document_id,
            chunkIndex: result.chunk_index,
            chunkContent: result.chunk_content,
            metadata: result.metadata || {},
            createdAt: result.created_at,
            similarityScore: result.similarity_score,
            textRankScore: result.text_rank_score,
            combinedScore: result.combined_score,
        }));
        // Step 4: Apply reranking if enabled
        if (useReranking && searchResults.length > 0) {
            try {
                // Rerank top 50 candidates to find the best rerankTopN results
                // Cohere Rerank v3.5 performs better with larger candidate pools
                const topResults = searchResults.slice(0, Math.min(50, searchResults.length));
                const documentsToRerank = topResults.map(result => ({
                    text: result.chunkContent,
                    metadata: result.metadata,
                }));
                const rerankedResults = await (0, embeddings_2.rerankDocuments)(query, documentsToRerank, rerankTopN);
                const rerankedMap = new Map(rerankedResults.map(r => [topResults[r.index].id, r.relevanceScore]));
                searchResults = searchResults.map(result => ({
                    ...result,
                    rerankScore: rerankedMap.get(result.id),
                }));
                searchResults.sort((a, b) => {
                    const scoreA = a.rerankScore ?? -1;
                    const scoreB = b.rerankScore ?? -1;
                    return scoreB - scoreA;
                });
            }
            catch (rerankError) {
                console.warn(`Reranking failed, falling back to vector search results: ${rerankError.message}`);
                searchResults = searchResults.slice(0, rerankTopN);
            }
        }
        return searchResults;
    }
    catch (error) {
        throw new Error(`Search failed: ${error.message || 'Unknown error'}`);
    }
}
/**
 * Searches for similar chunks to a given document chunk
 * Useful for finding related content
 *
 * @param chunkId - UUID of the chunk to find similar content for
 * @param tenantId - UUID of the tenant
 * @param limit - Maximum number of results
 * @returns Array of similar chunks
 */
async function findSimilarChunks(chunkId, tenantId, limit = 10) {
    try {
        const { data: chunk, error: fetchError } = await supabase_1.supabaseAdmin
            .from('document_embeddings')
            .select('chunk_content, embedding')
            .eq('id', chunkId)
            .eq('tenant_id', tenantId)
            .single();
        if (fetchError || !chunk) {
            throw new Error('Chunk not found');
        }
        const { data: results, error: searchError } = await supabase_1.supabaseAdmin
            .rpc('hybrid_search', {
            query_embedding: chunk.embedding,
            query_text: chunk.chunk_content,
            p_tenant_id: tenantId,
            match_count: limit + 1,
        });
        if (searchError) {
            throw new Error(`Similar chunk search failed: ${searchError.message}`);
        }
        if (!results || results.length === 0) {
            return [];
        }
        return results
            .filter((result) => result.id !== chunkId)
            .slice(0, limit)
            .map((result) => ({
            id: result.id,
            documentId: result.document_id,
            chunkIndex: result.chunk_index,
            chunkContent: result.chunk_content,
            metadata: result.metadata || {},
            createdAt: result.created_at,
            similarityScore: result.similarity_score,
            textRankScore: result.text_rank_score,
            combinedScore: result.combined_score,
        }));
    }
    catch (error) {
        throw new Error(`Find similar chunks failed: ${error.message || 'Unknown error'}`);
    }
}
/**
 * Gets embedding statistics for a tenant
 *
 * @param tenantId - UUID of the tenant
 * @returns Statistics about embeddings
 */
async function getEmbeddingStats(tenantId) {
    const { data: stats, error } = await supabase_1.supabaseAdmin
        .from('document_embeddings')
        .select('document_id')
        .eq('tenant_id', tenantId);
    if (error) {
        throw new Error(`Failed to get embedding stats: ${error.message}`);
    }
    const totalChunks = stats?.length || 0;
    const uniqueDocuments = new Set(stats?.map(s => s.document_id) || []).size;
    const avgChunksPerDocument = uniqueDocuments > 0 ? totalChunks / uniqueDocuments : 0;
    return {
        totalChunks,
        totalDocuments: uniqueDocuments,
        avgChunksPerDocument: Math.round(avgChunksPerDocument * 100) / 100,
    };
}
//# sourceMappingURL=search.js.map