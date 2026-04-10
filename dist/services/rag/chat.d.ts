/**
 * RAG Chat Service
 * Handles chat completion with RAG context retrieval
 *
 * Features:
 * - Query embedding generation
 * - Hybrid search with reranking
 * - Context-aware prompt building
 * - Streaming LLM responses
 * - Citation tracking
 */
import { SearchResult } from './search';
/**
 * Chat message for conversation history
 */
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
/**
 * Chat request interface
 */
export interface ChatRequest {
    tenantId: string;
    userId: string;
    query: string;
    history?: ChatMessage[];
    maxContextChunks?: number;
    model?: string;
    temperature?: number;
    stream?: boolean;
}
/**
 * Chat response interface
 */
export interface ChatResponse {
    answer: string;
    citations: SearchResult[];
    model: string;
    tokensInput: number;
    tokensOutput: number;
}
/**
 * Performs RAG chat completion with context retrieval
 *
 * @param request - Chat request parameters
 * @returns Chat response with answer and citations
 */
export declare function chatWithRAG(request: ChatRequest): Promise<ChatResponse>;
/**
 * Performs RAG chat completion with streaming response
 *
 * @param request - Chat request parameters
 * @returns Async generator yielding text chunks and final response
 */
export declare function chatWithRAGStream(request: ChatRequest): AsyncGenerator<string, ChatResponse, undefined>;
//# sourceMappingURL=chat.d.ts.map