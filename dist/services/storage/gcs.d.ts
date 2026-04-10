/**
 * Google Cloud Storage Service
 * Handles temporary video uploads for Gemini transcription
 *
 * Videos are uploaded to a GCS bucket and then passed to Vertex AI
 * via gs:// URI for native video processing.
 */
/**
 * Upload a local file to GCS and return the gs:// URI
 *
 * @param localFilePath - Path to local file
 * @param destinationName - Name for the file in GCS (without path)
 * @param contentType - MIME type of the file (default: video/mp4)
 * @returns GCS URI (gs://bucket/path)
 */
export declare function uploadToGCS(localFilePath: string, destinationName: string, contentType?: string): Promise<string>;
/**
 * Upload a buffer directly to GCS and return the gs:// URI
 *
 * @param buffer - File buffer
 * @param destinationName - Name for the file in GCS (without path)
 * @param contentType - MIME type of the file
 * @returns GCS URI (gs://bucket/path)
 */
export declare function uploadBufferToGCS(buffer: Buffer, destinationName: string, contentType: string): Promise<string>;
/**
 * Download a file from GCS to local filesystem
 *
 * @param gcsUri - GCS URI (gs://bucket/path)
 * @param localDestination - Local file path to save to
 * @returns Local file path
 */
export declare function downloadFromGCS(gcsUri: string, localDestination: string): Promise<string>;
/**
 * Delete a file from GCS
 *
 * @param gcsUri - GCS URI (gs://bucket/path)
 */
export declare function deleteFromGCS(gcsUri: string): Promise<void>;
/**
 * Check if GCS is properly configured
 */
export declare function isGCSConfigured(): boolean;
//# sourceMappingURL=gcs.d.ts.map