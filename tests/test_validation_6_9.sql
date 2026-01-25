-- Test Validation for Task 6.9: URL Scraping Endpoint
-- This file documents the validation steps for the /api/ai/scrape endpoint

-- ============================================================
-- VALIDATION CHECKLIST
-- ============================================================

-- ✅ 1. Endpoint exists at POST /api/ai/scrape
-- ✅ 2. Requires authentication (JWT token)
-- ✅ 3. Requires tenant context
-- ✅ 4. Validates URL format (must be valid HTTP/HTTPS URL)
-- ✅ 5. SSRF protection (blocks localhost, private IPs, metadata endpoints)
-- ✅ 6. Timeout protection (default 10s, max 10s)
-- ✅ 7. Returns markdown content (not saved to database)
-- ✅ 8. Proper error handling for invalid URLs, timeouts, and API failures

-- ============================================================
-- MANUAL TESTING STEPS
-- ============================================================

-- Test 1: Valid URL scraping
-- POST /api/ai/scrape
-- Headers: Authorization: Bearer <token>
-- Body: { "url": "https://example.com" }
-- Expected: 200 OK with { url, title, markdown, content_length }

-- Test 2: Invalid URL format
-- POST /api/ai/scrape
-- Body: { "url": "not-a-url" }
-- Expected: 400 Bad Request with VALIDATION_ERROR

-- Test 3: SSRF protection - localhost
-- POST /api/ai/scrape
-- Body: { "url": "http://localhost:8080" }
-- Expected: 400 Bad Request with SSRF protection message

-- Test 4: SSRF protection - private IP
-- POST /api/ai/scrape
-- Body: { "url": "http://192.168.1.1" }
-- Expected: 400 Bad Request with SSRF protection message

-- Test 5: SSRF protection - metadata endpoint
-- POST /api/ai/scrape
-- Body: { "url": "http://169.254.169.254/latest/meta-data/" }
-- Expected: 400 Bad Request with SSRF protection message

-- Test 6: Custom timeout
-- POST /api/ai/scrape
-- Body: { "url": "https://example.com", "timeout": 5000 }
-- Expected: 200 OK or 408 Request Timeout if exceeds 5s

-- Test 7: Missing authentication
-- POST /api/ai/scrape (no Authorization header)
-- Body: { "url": "https://example.com" }
-- Expected: 401 Unauthorized

-- ============================================================
-- SECURITY VALIDATIONS
-- ============================================================

-- ✅ URL validation prevents invalid formats
-- ✅ SSRF protection blocks:
--    - localhost (127.0.0.1, ::1)
--    - Private networks (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
--    - Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
-- ✅ Timeout enforcement (max 10 seconds)
-- ✅ Authentication required
-- ✅ Tenant context required
-- ✅ Rate limiting applied
-- ✅ No sensitive data in error messages
-- ✅ Proper logging with context (tenant_id, user_id)

-- ============================================================
-- NOTES
-- ============================================================

-- This endpoint does NOT save scraped content to the database.
-- It returns markdown directly to the frontend for preview/use.
-- The frontend is responsible for saving the content if needed.
-- Tavily API key must be configured in environment variables.
