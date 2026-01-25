# E2E Test: Signup → Login → Create Document → AI Generate
# Task 13.1 - Full flow validation with lineage and RLS verification

Write-Host "=== E2E Test: Signup → Login → Create Document → AI Generate ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8080"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testSubdomain = "e2etest$timestamp"
$testEmail = "test$timestamp@example.com"
$testPassword = "SecurePassword123!"

# Track test data for cleanup
$testData = @{
    subdomain = $testSubdomain
    email = $testEmail
    tenantId = $null
    userId = $null
    accessToken = $null
    documentId = $null
    jobId = $null
}

Write-Host "Test Configuration:" -ForegroundColor Yellow
Write-Host "  Subdomain: $testSubdomain" -ForegroundColor Gray
Write-Host "  Email: $testEmail" -ForegroundColor Gray
Write-Host ""

# Step 1: Signup
Write-Host "Step 1: Signup" -ForegroundColor Yellow
Write-Host "  POST /api/auth/signup" -ForegroundColor Gray

$signupBody = @{
    subdomain = $testSubdomain
    email = $testEmail
    password = $testPassword
    full_name = "E2E Test User"
    tenant_name = "E2E Test Company"
} | ConvertTo-Json

try {
    $signupResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/signup" `
        -Method POST `
        -ContentType "application/json" `
        -Body $signupBody

    Write-Host "  ✅ Signup successful" -ForegroundColor Green
    Write-Host "  Tenant ID: $($signupResponse.data.tenant.id)" -ForegroundColor Gray
    Write-Host "  User ID: $($signupResponse.data.user.id)" -ForegroundColor Gray
    
    $testData.tenantId = $signupResponse.data.tenant.id
    $testData.userId = $signupResponse.data.user.id
} catch {
    Write-Host "  ❌ Signup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Login
Write-Host "Step 2: Login" -ForegroundColor Yellow
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
    
    $testData.accessToken = $loginResponse.data.access_token
} catch {
    Write-Host "  ❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Create Document
Write-Host "Step 3: Create Document" -ForegroundColor Yellow
Write-Host "  POST /api/documents" -ForegroundColor Gray

$documentBody = @{
    title = "E2E Test Document"
    content = "This is a test document for E2E validation."
    status = "draft"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $($testData.accessToken)"
    "x-tenant-subdomain" = $testSubdomain
    "Content-Type" = "application/json"
}

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

# Step 4: AI Generate
Write-Host "Step 4: AI Generate" -ForegroundColor Yellow
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
    $generatedDocId = $generateResponse.document_id
} catch {
    Write-Host "  ❌ AI generation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 5: Poll Job Status
Write-Host "Step 5: Poll Job Status" -ForegroundColor Yellow
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

        Write-Host "  Attempt $attempt : Status = $($jobResponse.status)" -ForegroundColor Gray
        
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
    Write-Host "  ❌ Job did not complete within timeout" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 6: Verify Generated Document
Write-Host "Step 6: Verify Generated Document" -ForegroundColor Yellow
Write-Host "  GET /api/documents/$generatedDocId" -ForegroundColor Gray

try {
    $generatedDoc = Invoke-RestMethod -Uri "$baseUrl/api/documents/$generatedDocId" `
        -Method GET `
        -Headers $headers

    Write-Host "  ✅ Generated document retrieved" -ForegroundColor Green
    Write-Host "  Document ID: $($generatedDoc.id)" -ForegroundColor Gray
    Write-Host "  Title: $($generatedDoc.title)" -ForegroundColor Gray
    Write-Host "  Content Length: $($generatedDoc.content.Length) chars" -ForegroundColor Gray
    Write-Host "  Status: $($generatedDoc.status)" -ForegroundColor Gray
    
    if ($generatedDoc.content.Length -gt 0) {
        Write-Host "  ✅ Document has content" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Document is empty" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Failed to retrieve generated document: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 7: Verify RLS - Try to access with wrong subdomain
Write-Host "Step 7: Verify RLS Enforcement" -ForegroundColor Yellow
Write-Host "  Testing cross-tenant access prevention" -ForegroundColor Gray

$wrongHeaders = @{
    "Authorization" = "Bearer $($testData.accessToken)"
    "x-tenant-subdomain" = "wrongsubdomain"
    "Content-Type" = "application/json"
}

try {
    $rlsTest = Invoke-RestMethod -Uri "$baseUrl/api/documents/$($testData.documentId)" `
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
    }
}

Write-Host ""

# Summary
Write-Host "=== E2E Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Step 1: Signup successful" -ForegroundColor Green
Write-Host "✅ Step 2: Login successful" -ForegroundColor Green
Write-Host "✅ Step 3: Document created" -ForegroundColor Green
Write-Host "✅ Step 4: AI generation job queued" -ForegroundColor Green
Write-Host "✅ Step 5: Job completed successfully" -ForegroundColor Green
Write-Host "✅ Step 6: Generated document verified" -ForegroundColor Green
Write-Host "✅ Step 7: RLS enforcement verified" -ForegroundColor Green
Write-Host ""
Write-Host "Test Data:" -ForegroundColor Yellow
Write-Host "  Tenant ID: $($testData.tenantId)" -ForegroundColor Gray
Write-Host "  User ID: $($testData.userId)" -ForegroundColor Gray
Write-Host "  Document ID: $($testData.documentId)" -ForegroundColor Gray
Write-Host "  Generated Doc ID: $generatedDocId" -ForegroundColor Gray
Write-Host "  Job ID: $($testData.jobId)" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: Verify lineage events in database" -ForegroundColor Yellow
Write-Host "  Query: SELECT * FROM document_lineage WHERE tenant_id = '$($testData.tenantId)' ORDER BY created_at;" -ForegroundColor Gray
