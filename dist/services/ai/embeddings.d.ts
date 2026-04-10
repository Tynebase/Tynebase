/**
 * AWS Bedrock Cohere Embedding Service
 * Handles text embeddings using Cohere Embed v4.0 through AWS Bedrock (eu-west-2)
 *
 * Features:
 * - Cohere Embed v4.0 with 1536 dimensions (default)
 * - Cohere Rerank v3.5 for result reranking
 * - Batch embedding support
 * - Automatic retry on throttling
 * - UK data residency compliance (eu-west-2)
 */
/**
 * Embedding dimensions for Cohere Embed v4
 */
export declare const EMBEDDING_DIMENSIONS = 1536;
/**
 * Generates embeddings for text (Optimized for Search/Query)
 * Uses London region + Global profile for best performance
 */
export declare function generateEmbedding(text: string, inputType?: 'search_document' | 'search_query'): Promise<number[]>;
/**
 * Batch generates embeddings (Optimized for Indexing)
 * Uses Ireland region + Regional ID for batch support
 */
export declare function generateEmbeddingsBatch(texts: string[], inputType?: 'search_document' | 'search_query'): Promise<number[][]>;
/**
 * Document interface for reranking
 */
export interface RerankDocument {
    text: string;
    metadata?: Record<string, any>;
}
/**
 * Reranked result interface
 */
export interface RerankResult {
    index: number;
    relevanceScore: number;
    document: RerankDocument;
}
/**
 * Reranks documents using Cohere Rerank 3.5
 * Uses Frankfurt region as required
 */
export declare function rerankDocuments(query: string, documents: RerankDocument[], topN?: number): Promise<RerankResult[]>;
//# sourceMappingURL=embeddings.d.ts.map