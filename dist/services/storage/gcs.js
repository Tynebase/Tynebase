"use strict";
/**
 * Google Cloud Storage Service
 * Handles temporary video uploads for Gemini transcription
 *
 * Videos are uploaded to a GCS bucket and then passed to Vertex AI
 * via gs:// URI for native video processing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToGCS = uploadToGCS;
exports.uploadBufferToGCS = uploadBufferToGCS;
exports.downloadFromGCS = downloadFromGCS;
exports.deleteFromGCS = deleteFromGCS;
exports.isGCSConfigured = isGCSConfigured;
const storage_1 = require("@google-cloud/storage");
let storageClient = null;
const GCS_CONFIG = {
    bucketName: process.env.GCS_VIDEO_BUCKET || 'tynebase-video-uploads',
    projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
};
/**
 * Parses service account credentials from environment
 */
function getServiceAccountCredentials() {
    const gcpJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
    if (!gcpJson) {
        return null;
    }
    try {
        const decoded = Buffer.from(gcpJson, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    }
    catch (e) {
        try {
            return JSON.parse(gcpJson);
        }
        catch (err) {
            console.error('Failed to parse GCP_SERVICE_ACCOUNT_JSON:', err);
            return null;
        }
    }
}
/**
 * Initialize GCS client
 */
function getStorageClient() {
    if (!storageClient) {
        const credentials = getServiceAccountCredentials();
        let projectId = GCS_CONFIG.projectId;
        if (credentials) {
            projectId = projectId || credentials.project_id;
            storageClient = new storage_1.Storage({
                projectId,
                credentials,
            });
        }
        else {
            storageClient = new storage_1.Storage({
                projectId,
            });
        }
    }
    return storageClient;
}
/**
 * Upload a local file to GCS and return the gs:// URI
 *
 * @param localFilePath - Path to local file
 * @param destinationName - Name for the file in GCS (without path)
 * @param contentType - MIME type of the file (default: video/mp4)
 * @returns GCS URI (gs://bucket/path)
 */
async function uploadToGCS(localFilePath, destinationName, contentType = 'video/mp4') {
    const storage = getStorageClient();
    const bucket = storage.bucket(GCS_CONFIG.bucketName);
    const destination = `video-uploads/${destinationName}`;
    await bucket.upload(localFilePath, {
        destination,
        metadata: {
            contentType,
        },
    });
    const gcsUri = `gs://${GCS_CONFIG.bucketName}/${destination}`;
    console.log(`[GCS] Uploaded ${localFilePath} to ${gcsUri}`);
    return gcsUri;
}
/**
 * Upload a buffer directly to GCS and return the gs:// URI
 *
 * @param buffer - File buffer
 * @param destinationName - Name for the file in GCS (without path)
 * @param contentType - MIME type of the file
 * @returns GCS URI (gs://bucket/path)
 */
async function uploadBufferToGCS(buffer, destinationName, contentType) {
    const storage = getStorageClient();
    const bucket = storage.bucket(GCS_CONFIG.bucketName);
    const destination = `video-uploads/${destinationName}`;
    const file = bucket.file(destination);
    await file.save(buffer, {
        metadata: {
            contentType,
        },
    });
    const gcsUri = `gs://${GCS_CONFIG.bucketName}/${destination}`;
    console.log(`[GCS] Uploaded buffer to ${gcsUri}`);
    return gcsUri;
}
/**
 * Download a file from GCS to local filesystem
 *
 * @param gcsUri - GCS URI (gs://bucket/path)
 * @param localDestination - Local file path to save to
 * @returns Local file path
 */
async function downloadFromGCS(gcsUri, localDestination) {
    const storage = getStorageClient();
    // Parse gs://bucket/path format
    const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
        throw new Error(`Invalid GCS URI: ${gcsUri}`);
    }
    const [, bucketName, filePath] = match;
    const bucket = storage.bucket(bucketName);
    await bucket.file(filePath).download({
        destination: localDestination,
    });
    console.log(`[GCS] Downloaded ${gcsUri} to ${localDestination}`);
    return localDestination;
}
/**
 * Delete a file from GCS
 *
 * @param gcsUri - GCS URI (gs://bucket/path)
 */
async function deleteFromGCS(gcsUri) {
    const storage = getStorageClient();
    // Parse gs://bucket/path format
    const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
        throw new Error(`Invalid GCS URI: ${gcsUri}`);
    }
    const [, bucketName, filePath] = match;
    const bucket = storage.bucket(bucketName);
    await bucket.file(filePath).delete();
    console.log(`[GCS] Deleted ${gcsUri}`);
}
/**
 * Check if GCS is properly configured
 */
function isGCSConfigured() {
    const credentials = getServiceAccountCredentials();
    const projectId = GCS_CONFIG.projectId || credentials?.project_id;
    return !!projectId && !!GCS_CONFIG.bucketName;
}
//# sourceMappingURL=gcs.js.map