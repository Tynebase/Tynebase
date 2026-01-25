# Test Error Handler - Task 12.4 Validation
# Tests error logging with context and verifies generic 500 messages

Write-Host "=== Testing Error Handler ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8080"

# Test 1: 500 Error - Should return generic message
Write-Host "Test 1: Internal Server Error (500)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/test/error/500" -Method GET -ErrorAction Stop
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $content = $_.ErrorDetails.Message
    Write-Host "Status Code: $statusCode" -ForegroundColor Green
    Write-Host "Response: $content" -ForegroundColor Green
    
    # Verify generic message (no internal details exposed)
    if ($content -match "internal server error occurred") {
        Write-Host "✅ PASS: Generic error message returned (no internal details)" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Error message not generic" -ForegroundColor Red
    }
}
Write-Host ""

# Test 2: 400 Error - Should return specific message
Write-Host "Test 2: Client Error (400)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/test/error/400" -Method GET -ErrorAction Stop
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $content = $_.ErrorDetails.Message
    Write-Host "Status Code: $statusCode" -ForegroundColor Green
    Write-Host "Response: $content" -ForegroundColor Green
    
    if ($content -match "Invalid request parameters") {
        Write-Host "✅ PASS: Specific client error message returned" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Client error message incorrect" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: 401 Error
Write-Host "Test 3: Unauthorized Error (401)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/test/error/401" -Method GET -ErrorAction Stop
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $content = $_.ErrorDetails.Message
    Write-Host "Status Code: $statusCode" -ForegroundColor Green
    Write-Host "Response: $content" -ForegroundColor Green
    
    if ($statusCode -eq 401) {
        Write-Host "✅ PASS: Unauthorized error returned" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Wrong status code" -ForegroundColor Red
    }
}
Write-Host ""

# Test 4: Validation Error with Details
Write-Host "Test 4: Validation Error (422)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/test/error/validation" -Method POST -ContentType "application/json" -Body '{}' -ErrorAction Stop
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $content = $_.ErrorDetails.Message
    Write-Host "Status Code: $statusCode" -ForegroundColor Green
    Write-Host "Response: $content" -ForegroundColor Green
    
    if ($content -match "validation" -and $content -match "details") {
        Write-Host "✅ PASS: Validation error includes details" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Validation error missing details" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: Check server logs to verify:" -ForegroundColor Yellow
Write-Host "  - Stack traces logged for 500 errors" -ForegroundColor Yellow
Write-Host "  - User context included (user_id, tenant_id)" -ForegroundColor Yellow
Write-Host "  - Request details logged (method, path, ip)" -ForegroundColor Yellow
Write-Host "  - Sensitive data redacted from logs" -ForegroundColor Yellow
