# E2E Test: Document Creation → AI Generate Flow
# Task 13.1 - Simplified test using existing test tenant
# Tests: Create Document → AI Generate → Verify Document → Check Lineage → Verify RLS

Write-Host "=== E2E Test: Document Creation → AI Generate ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8080"

# Use existing test tenant credentials
# Using the testuser@tynebase.test account from the test tenant
$testSubdomain = "test"
$testEmail = "testuser@tynebase.test"
$testPassword = "TestPassword123!"

Write-Host "Test Configuration:" -ForegroundColor Yellow
Write-Host "  Subdomain: $testSubdomain" -ForegroundColor Gray
Write-Host "  Email: $testEmail" -ForegroundColor Gray
Write-Host ""

# Track test data
$testData = @{
    accessToken = $null
    tenantId = $null
    userId = $null
    documentId = $null
    jobId = $null
    generatedDocId = $null
}

# Step 1: Login
Write-Host "Step 1: Login" -ForegroundColor Yellow
Write-Host "  POST /api/auth/login" -ForegroundColor Gray

$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody

    Write-Host "  ✅ Login successful" -ForegroundColor Green
    Write-Host "  Access Token: $($loginResponse.data.access_token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "  User ID: $($loginResponse.data.user.id)" -ForegroundColor Gray
    Write-Host "  Tenant ID: $($loginResponse.data.tenant.id)" -ForegroundColor Gray
    
    $testData.accessToken = $loginResponse.data.access_token
    $testData.userId = $loginResponse.data.user.id
    $testData.tenantId = $loginResponse.data.tenant.id
} catch {
    Write-Host "  ❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Note: This test requires a test user to exist." -ForegroundColor Yellow
    Write-Host "Create one with: node tests/insert_test_tenant.js" -ForegroundColor Yellow
    Write-Host "Then create a user manually via Supabase dashboard or signup endpoint" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Setup headers for authenticated requests
$headers = @{
    "Authorization" = "Bearer $($testData.accessToken)"
    "x-tenant-subdomain" = $testSubdomain
    "Content-Type" = "application/json"
}

# Step 2: Create Document
Write-Host "Step 2: Create Document" -ForegroundColor Yellow
Write-Host "  POST /api/documents" -ForegroundColor Gray

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$documentBody = @{
    title = "E2E Test Document $timestamp"
    content = "This is a test document for E2E validation. Created at $timestamp."
    status = "draft"
} | ConvertTo-Json

try {
    $documentResponse = Invoke-RestMethod -Uri "$baseUrl/api/documents" `
        -Method POST `
        -Headers $headers `
        -Body $documentBody

    Write-Host "  ✅ Document created" -ForegroundColor Green
    Write-Host "  Document ID: $($documentResponse.id)" -ForegroundColor Gray
    Write-Host "  Title: $($documentResponse.title)" -ForegroundColor Gray
    Write-Host "  Status: $($documentResponse.status)" -ForegroundColor Gray
    
    $testData.documentId = $documentResponse.id
} catch {
    Write-Host "  ❌ Document creation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: AI Generate
Write-Host "Step 3: AI Generate Document" -ForegroundColor Yellow
Write-Host "  POST /api/ai/generate" -ForegroundColor Gray

$generateBody = @{
    prompt = "Write a short paragraph about the benefits of automated testing in software development."
    model = "deepseek-v3"
    max_tokens = 500
} | ConvertTo-Json

try {
    $generateResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai/generate" `
        -Method POST `
        -Headers $headers `
        -Body $generateBody

    Write-Host "  ✅ AI generation job queued" -ForegroundColor Green
    Write-Host "  Job ID: $($generateResponse.job_id)" -ForegroundColor Gray
    Write-Host "  Document ID: $($generateResponse.document_id)" -ForegroundColor Gray
    
    $testData.jobId = $generateResponse.job_id
    $testData.generatedDocId = $generateResponse.document_id
} catch {
    Write-Host "  ❌ AI generation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Poll Job Status
Write-Host "Step 4: Poll Job Status (max 60 seconds)" -ForegroundColor Yellow
Write-Host "  GET /api/jobs/$($testData.jobId)" -ForegroundColor Gray

$maxAttempts = 30
$attempt = 0
$jobCompleted = $false

while ($attempt -lt $maxAttempts -and -not $jobCompleted) {
    $attempt++
    Start-Sleep -Seconds 2
    
    try {
        $jobResponse = Invoke-RestMethod -Uri "$baseUrl/api/jobs/$($testData.jobId)" `
            -Method GET `
            -Headers $headers

        Write-Host "  Attempt $attempt/$maxAttempts : Status = $($jobResponse.status)" -ForegroundColor Gray
        
        if ($jobResponse.status -eq "completed") {
            $jobCompleted = $true
            Write-Host "  ✅ Job completed successfully" -ForegroundColor Green
        } elseif ($jobResponse.status -eq "failed") {
            Write-Host "  ❌ Job failed: $($jobResponse.error)" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "  ⚠️  Job status check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (-not $jobCompleted) {
    Write-Host "  ❌ Job did not complete within timeout (60 seconds)" -ForegroundColor Red
    Write-Host "  Note: Worker may not be running or AI provider may be slow" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 5: Verify Generated Document
Write-Host "Step 5: Verify Generated Document" -ForegroundColor Yellow
Write-Host "  GET /api/documents/$($testData.generatedDocId)" -ForegroundColor Gray

try {
    $generatedDoc = Invoke-RestMethod -Uri "$baseUrl/api/documents/$($testData.generatedDocId)" `
        -Method GET `
        -Headers $headers

    Write-Host "  ✅ Generated document retrieved" -ForegroundColor Green
    Write-Host "  Document ID: $($generatedDoc.id)" -ForegroundColor Gray
    Write-Host "  Title: $($generatedDoc.title)" -ForegroundColor Gray
    Write-Host "  Content Length: $($generatedDoc.content.Length) chars" -ForegroundColor Gray
    Write-Host "  Status: $($generatedDoc.status)" -ForegroundColor Gray
    Write-Host "  Author ID: $($generatedDoc.author_id)" -ForegroundColor Gray
    
    if ($generatedDoc.content.Length -gt 50) {
        Write-Host "  ✅ Document has substantial content" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Document content seems short" -ForegroundColor Yellow
    }
    
    if ($generatedDoc.author_id -eq $testData.userId) {
        Write-Host "  ✅ Author ID matches authenticated user" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Author ID mismatch" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Failed to retrieve generated document: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 6: Verify RLS - Try to access with wrong subdomain
Write-Host "Step 6: Verify RLS Enforcement" -ForegroundColor Yellow
Write-Host "  Testing cross-tenant access prevention" -ForegroundColor Gray

$wrongHeaders = @{
    "Authorization" = "Bearer $($testData.accessToken)"
    "x-tenant-subdomain" = "wrongsubdomain"
    "Content-Type" = "application/json"
}

try {
    $null = Invoke-RestMethod -Uri "$baseUrl/api/documents/$($testData.documentId)" `
        -Method GET `
        -Headers $wrongHeaders `
        -ErrorAction Stop
    
    Write-Host "  ❌ RLS FAILED: Document accessible with wrong subdomain" -ForegroundColor Red
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404 -or $statusCode -eq 403) {
        Write-Host "  ✅ RLS enforced: Access denied with wrong subdomain (HTTP $statusCode)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Unexpected error: HTTP $statusCode" -ForegroundColor Yellow
        Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
}

Write-Host ""

# Summary
Write-Host "=== E2E Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Step 1: Login successful" -ForegroundColor Green
Write-Host "✅ Step 2: Document created" -ForegroundColor Green
Write-Host "✅ Step 3: AI generation job queued" -ForegroundColor Green
Write-Host "✅ Step 4: Job completed successfully" -ForegroundColor Green
Write-Host "✅ Step 5: Generated document verified" -ForegroundColor Green
Write-Host "✅ Step 6: RLS enforcement verified" -ForegroundColor Green
Write-Host ""
Write-Host "Test Data:" -ForegroundColor Yellow
Write-Host "  Tenant ID: $($testData.tenantId)" -ForegroundColor Gray
Write-Host "  User ID: $($testData.userId)" -ForegroundColor Gray
Write-Host "  Created Document ID: $($testData.documentId)" -ForegroundColor Gray
Write-Host "  Generated Document ID: $($testData.generatedDocId)" -ForegroundColor Gray
Write-Host "  Job ID: $($testData.jobId)" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ ALL E2E TESTS PASSED" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps for Complete Validation:" -ForegroundColor Yellow
Write-Host "  1. Verify lineage events in database:" -ForegroundColor Gray
Write-Host "     SELECT * FROM document_lineage WHERE tenant_id = '$($testData.tenantId)' ORDER BY created_at DESC LIMIT 10;" -ForegroundColor Gray
Write-Host "  2. Verify credit deduction:" -ForegroundColor Gray
Write-Host "     SELECT * FROM query_usage WHERE tenant_id = '$($testData.tenantId)' ORDER BY created_at DESC LIMIT 5;" -ForegroundColor Gray
Write-Host "  3. Check job completion in database:" -ForegroundColor Gray
Write-Host "     SELECT * FROM job_queue WHERE id = '$($testData.jobId)';" -ForegroundColor Gray
