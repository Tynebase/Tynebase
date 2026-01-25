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

import { supabaseAdmin } from '../../lib/supabase';
import { generateEmbedding } from '../ai/embeddings';
import { rerankDocuments, RerankDocument } from '../ai/embeddings';

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
export async function searchDocuments(options: SearchOptions): Promise<SearchResult[]> {
  const {
    tenantId,
    query,
    limit = 50,
    useReranking = true,
    rerankTopN = 10,
  } = options;

  try {
    // Step 1: Generate query embedding
    const queryEmbedding = await generateEmbedding(query, 'search_query');

    // Step 2: Perform hybrid search using database function
    const { data: results, error: searchError } = await supabaseAdmin
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
    let searchResults: SearchResult[] = results.map((result: any) => ({
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
        const topResults = searchResults.slice(0, Math.min(rerankTopN * 2, searchResults.length));
        
        const documentsToRerank: RerankDocument[] = topResults.map(result => ({
          text: result.chunkContent,
          metadata: result.metadata,
        }));

        const rerankedResults = await rerankDocuments(
          query,
          documentsToRerank,
          rerankTopN
        );

        const rerankedMap = new Map(
          rerankedResults.map(r => [topResults[r.index].id, r.relevanceScore])
        );

        searchResults = searchResults.map(result => ({
          ...result,
          rerankScore: rerankedMap.get(result.id),
        }));

        searchResults.sort((a, b) => {
          const scoreA = a.rerankScore ?? -1;
          const scoreB = b.rerankScore ?? -1;
          return scoreB - scoreA;
        });
      } catch (rerankError: any) {
        console.warn(`Reranking failed, falling back to vector search results: ${rerankError.message}`);
        searchResults = searchResults.slice(0, rerankTopN);
      }
    }

    return searchResults;
  } catch (error: any) {
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
export async function findSimilarChunks(
  chunkId: string,
  tenantId: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const { data: chunk, error: fetchError } = await supabaseAdmin
      .from('document_embeddings')
      .select('chunk_content, embedding')
      .eq('id', chunkId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !chunk) {
      throw new Error('Chunk not found');
    }

    const { data: results, error: searchError } = await supabaseAdmin
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
      .filter((result: any) => result.id !== chunkId)
      .slice(0, limit)
      .map((result: any) => ({
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
  } catch (error: any) {
    throw new Error(`Find similar chunks failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Gets embedding statistics for a tenant
 * 
 * @param tenantId - UUID of the tenant
 * @returns Statistics about embeddings
 */
export async function getEmbeddingStats(tenantId: string): Promise<{
  totalChunks: number;
  totalDocuments: number;
  avgChunksPerDocument: number;
}> {
  const { data: stats, error } = await supabaseAdmin
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
