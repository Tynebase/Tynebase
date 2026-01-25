# Manual Test: Document Asset Upload Endpoint

## Endpoint
`POST /api/documents/:id/upload`

## Prerequisites
1. Backend server running on http://localhost:8080
2. Valid JWT token from authenticated user
3. Test document created in the database
4. Test image or video file

## Test Steps

### 1. Authenticate and Get Token
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-subdomain: test" \
  -d '{"email":"test@test.com","password":"testpassword123"}'
```

Save the `token` from the response.

### 2. Create a Test Document
```bash
curl -X POST http://localhost:8080/api/documents \
  -H "Content-Type: application/json" \
  -H "x-tenant-subdomain: test" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Test Document for Asset Upload","content":"Test content"}'
```

Save the `document.id` from the response.

### 3. Upload an Image Asset
```bash
curl -X POST http://localhost:8080/api/documents/DOCUMENT_ID/upload \
  -H "x-tenant-subdomain: test" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/test-image.png"
```

### Expected Response (201 Created)
```json
{
  "success": true,
  "data": {
    "storage_path": "tenant-{tenant_id}/documents/{document_id}/{timestamp}_test-image.png",
    "signed_url": "https://...supabase.co/storage/v1/object/sign/tenant-documents/...",
    "filename": "test-image.png",
    "file_size": 12345,
    "mimetype": "image/png",
    "asset_type": "image",
    "expires_in": 3600
  }
}
```

## Validation Checklist

### ✅ Security Validations
- [x] File type validation (only images and videos allowed)
- [x] File size validation (10MB for images, 50MB for videos)
- [x] Filename sanitization (removes special characters)
- [x] Document existence check (404 if document not found)
- [x] Tenant isolation (document must belong to user's tenant)
- [x] JWT authentication required
- [x] Membership guard enforced

### ✅ Storage Validations
- [x] Files stored in `tenant-documents` bucket
- [x] Storage path includes tenant ID and document ID
- [x] Timestamp prefix prevents filename collisions
- [x] Content-Type preserved from upload
- [x] Signed URL generated with 1-hour expiration

### ✅ Response Validations
- [x] Returns 201 on success
- [x] Returns storage_path
- [x] Returns signed_url
- [x] Returns asset_type (image or video)
- [x] Returns file metadata (size, mimetype, filename)

### ✅ Error Handling
- [x] 400 if no file uploaded
- [x] 400 if invalid file type
- [x] 400 if invalid file extension
- [x] 400 if file too large
- [x] 404 if document not found
- [x] 500 if upload fails
- [x] 500 if signed URL generation fails

## Allowed File Types

### Images (Max 10MB)
- image/jpeg (.jpg, .jpeg)
- image/png (.png)
- image/gif (.gif)
- image/webp (.webp)
- image/svg+xml (.svg)

### Videos (Max 50MB)
- video/mp4 (.mp4)
- video/quicktime (.mov)
- video/webm (.webm)

## Code Verification

### Route Implementation
- File: `backend/src/routes/document-assets.ts`
- Registered in: `backend/src/server.ts` (line 88)
- Middleware chain: rateLimitMiddleware → tenantContextMiddleware → authMiddleware → membershipGuard

### Key Security Features
1. **Input Validation**: Zod schema for document ID (UUID format)
2. **File Type Validation**: Whitelist of allowed MIME types and extensions
3. **File Size Limits**: Enforced before upload
4. **Filename Sanitization**: Regex replacement of unsafe characters
5. **Tenant Isolation**: Document lookup filtered by tenant_id
6. **Storage Isolation**: Files stored in tenant-specific paths
7. **Signed URLs**: Time-limited access (1 hour expiration)

### Database Verification
The endpoint verifies document existence and tenant ownership:
```sql
SELECT id FROM documents 
WHERE id = $1 AND tenant_id = $2
```

This ensures:
- Document exists
- User has access to the tenant
- No cross-tenant data leakage
