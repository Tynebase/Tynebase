-- Migration: Update tenant-uploads bucket size limit to 500MB for video uploads
-- Task: 6.1 - Support video file uploads up to 500MB

-- Update tenant-uploads bucket to allow 500MB files
UPDATE storage.buckets
SET file_size_limit = 524288000 -- 500MB in bytes
WHERE id = 'tenant-uploads';
