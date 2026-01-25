-- ============================================================
-- Test Validation for Task 6.8: DOCX Conversion Handler
-- ============================================================
-- Purpose: Verify DOCX conversion functionality in documentConvert.ts
-- Expected: Mammoth library converts DOCX to Markdown preserving structure
-- ============================================================

-- 1. Verify mammoth package is installed (check package.json manually)
-- Expected: mammoth@^1.11.0 in dependencies

-- 2. Check convertDocxToMarkdown function exists in documentConvert.ts
-- Expected: Function at lines 244-261 using mammoth.convertToMarkdown

-- 3. Verify DOCX mimetype handling in processConversion
-- Expected: Lines 102-107 handle both DOCX mimetypes:
--   - application/vnd.openxmlformats-officedocument.wordprocessingml.document
--   - application/msword

-- 4. Verify lineage event type for DOCX conversion
-- Expected: lineageEventType = 'converted_from_docx' (line 107)

-- 5. Test document_convert job processing with DOCX file
-- This requires actual file upload and job creation
-- Manual test steps:
--   a. Upload a test DOCX file via API
--   b. Verify job is created in job_queue
--   c. Worker processes job
--   d. Document created with markdown content
--   e. Lineage event created with type 'converted_from_docx'
--   f. Credit deducted (1 credit for document_conversion)

-- 6. Query recent DOCX conversions (if any exist)
SELECT 
    d.id,
    d.title,
    d.status,
    LENGTH(d.content) as content_length,
    dl.event_type,
    dl.metadata->>'original_filename' as original_file,
    dl.metadata->>'mimetype' as mimetype,
    dl.created_at as converted_at
FROM documents d
JOIN document_lineage dl ON d.id = dl.document_id
WHERE dl.event_type = 'converted_from_docx'
ORDER BY dl.created_at DESC
LIMIT 5;

-- 7. Verify credit usage for DOCX conversions
SELECT 
    qu.id,
    qu.query_type,
    qu.credits_used,
    qu.metadata->>'file_type' as file_type,
    qu.metadata->>'document_id' as document_id,
    qu.created_at
FROM query_usage qu
WHERE qu.query_type = 'document_conversion'
  AND qu.metadata->>'file_type' LIKE '%word%'
ORDER BY qu.created_at DESC
LIMIT 5;

-- ============================================================
-- VALIDATION CHECKLIST
-- ============================================================
-- [✓] mammoth package installed in package.json
-- [✓] convertDocxToMarkdown function implemented
-- [✓] DOCX mimetypes handled correctly
-- [✓] Lineage event type set to 'converted_from_docx'
-- [✓] Timeout protection (60s) implemented
-- [✓] Error handling with try-catch
-- [✓] Temporary file cleanup in finally block
-- [✓] Credit deduction (1 credit) for conversion
-- [ ] Manual test: Upload DOCX and verify conversion
-- ============================================================
