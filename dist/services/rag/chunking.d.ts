/**
 * Semantic Chunking Service
 * Implements structure-aware semantic chunking for optimal RAG performance
 *
 * Strategy: Four-pass hybrid approach
 * 1. Split by document structure (headings, sections)
 * 2. Apply semantic chunking within large sections
 * 3. Merge small adjacent chunks if semantically similar
 * 4. Add contextual prefix to each chunk
 *
 * Target: +50-70% accuracy improvement over baseline
 */
/**
 * Chunking configuration based on PRD requirements
 * Using token-based sizing to match validator logic and API limits
 */
export declare const CHUNKING_CONFIG: {
    TARGET_CHUNK_SIZE: number;
    OVERLAP_SIZE: number;
    MIN_CHUNK_SIZE: number;
    MAX_CHUNK_SIZE: number;
    SEMANTIC_SIMILARITY_THRESHOLD: number;
    WORDS_PER_TOKEN: number;
};
/**
 * Chunk interface with metadata
 */
export interface SemanticChunk {
    content: string;
    index: number;
    metadata: {
        heading?: string;
        level?: number;
        type?: 'heading' | 'paragraph' | 'list' | 'code' | 'table';
        tokenCount: number;
        hasContext: boolean;
    };
}
/**
 * Main semantic chunking function
 * Implements four-pass hybrid approach for optimal RAG performance
 *
 * @param markdown - Markdown content to chunk
 * @param documentTitle - Document title for context
 * @returns Array of semantic chunks with metadata
 */
export declare function chunkMarkdownSemanticaly(markdown: string, documentTitle?: string): SemanticChunk[];
/**
 * Validates chunk quality
 * Ensures chunks meet minimum quality standards
 */
export declare function validateChunks(chunks: SemanticChunk[]): {
    valid: boolean;
    issues: string[];
};
/**
 * Gets chunking statistics
 */
export declare function getChunkingStats(chunks: SemanticChunk[]): {
    totalChunks: number;
    avgTokensPerChunk: number;
    minTokens: number;
    maxTokens: number;
    chunksWithContext: number;
};
//# sourceMappingURL=chunking.d.ts.map