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
/**
 * Search result interface
 */
export interface SearchResult {
    id: string;
    documentId: string;
    chunkIndex: number;
    chunkContent: string;
    metadata: Record<string, any>;
    createdAt: string;
    similarityScore: number;
    textRankScore: number;
    combinedScore: number;
    rerankScore?: number;
}
/**
 * Search options interface
 */
export interface SearchOptions {
    tenantId: string;
    query: string;
    limit?: number;
    useReranking?: boolean;
    rerankTopN?: number;
}
/**
 * Performs hybrid search on document embeddings
 * Combines vector similarity search with full-text search
 *
 * @param options - Search options
 * @returns Array of search results
 */
export declare function searchDocuments(options: SearchOptions): Promise<SearchResult[]>;
/**
 * Searches for similar chunks to a given document chunk
 * Useful for finding related content
 *
 * @param chunkId - UUID of the chunk to find similar content for
 * @param tenantId - UUID of the tenant
 * @param limit - Maximum number of results
 * @returns Array of similar chunks
 */
export declare function findSimilarChunks(chunkId: string, tenantId: string, limit?: number): Promise<SearchResult[]>;
/**
 * Gets embedding statistics for a tenant
 *
 * @param tenantId - UUID of the tenant
 * @returns Statistics about embeddings
 */
export declare function getEmbeddingStats(tenantId: string): Promise<{
    totalChunks: number;
    totalDocuments: number;
    avgChunksPerDocument: number;
}>;
//# sourceMappingURL=search.d.ts.map