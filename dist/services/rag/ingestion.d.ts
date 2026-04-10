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
export declare function ingestDocument(documentId: string, tenantId: string, content: string, metadata?: Record<string, any>): Promise<IngestionResult>;
/**
 * Batch ingests multiple documents
 * Processes documents sequentially to avoid rate limits
 *
 * @param documents - Array of documents to ingest
 * @returns Array of ingestion results
 */
export declare function ingestDocumentsBatch(documents: Array<{
    documentId: string;
    tenantId: string;
    content: string;
    metadata?: Record<string, any>;
}>): Promise<IngestionResult[]>;
/**
 * Re-ingests all documents for a tenant
 * Useful after embedding model changes
 *
 * @param tenantId - UUID of the tenant
 * @returns Array of ingestion results
 */
export declare function reIngestTenantDocuments(tenantId: string): Promise<IngestionResult[]>;
//# sourceMappingURL=ingestion.d.ts.map