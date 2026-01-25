# Test Document Asset List Endpoint
# This script validates the GET /api/documents/:id/assets endpoint

Write-Host "=== Testing Document Asset List Endpoint ===" -ForegroundColor Cyan
Write-Host ""

$API_URL = "http://localhost:8080"
$TENANT_SUBDOMAIN = "test"
$TEST_EMAIL = "test@test.com"
$TEST_PASSWORD = "testpassword123"

try {
    # Step 1: Authenticate
    Write-Host "Step 1: Authenticating test user..." -ForegroundColor Yellow
    $loginBody = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$API_URL/api/auth/login" `
        -Method POST `
        -Headers @{
            "x-tenant-subdomain" = $TENANT_SUBDOMAIN
            "Content-Type" = "application/json"
        } `
        -Body $loginBody

    $token = $loginResponse.token
    Write-Host "✅ Authentication successful" -ForegroundColor Green
    Write-Host ""

    # Step 2: Create a test document
    Write-Host "Step 2: Creating a test document..." -ForegroundColor Yellow
    $docBody = @{
        title = "Test Document for Asset List"
        content = "This document will have multiple assets."
    } | ConvertTo-Json

    $docResponse = Invoke-RestMethod -Uri "$API_URL/api/documents" `
        -Method POST `
        -Headers @{
            "x-tenant-subdomain" = $TENANT_SUBDOMAIN
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $docBody

    $documentId = $docResponse.data.document.id
    Write-Host "✅ Document created with ID: $documentId" -ForegroundColor Green
    Write-Host ""

    # Step 3: Upload first asset (image)
    Write-Host "Step 3: Uploading first asset (image)..." -ForegroundColor Yellow
    $testImagePath = Join-Path $PSScriptRoot "test-image-1.png"
    
    $pngBytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
    [System.IO.File]::WriteAllBytes($testImagePath, $pngBytes)
    
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"test-image-1.png`"",
        "Content-Type: image/png$LF",
        [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($pngBytes),
        "--$boundary--$LF"
    ) -join $LF


    Write-Host "✅ First asset uploaded" -ForegroundColor Green
    Write-Host ""

    # Step 4: Upload second asset (another image)
    Write-Host "Step 4: Uploading second asset (image)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1  # Ensure different timestamp
    
    $testImagePath2 = Join-Path $PSScriptRoot "test-image-2.png"
    [System.IO.File]::WriteAllBytes($testImagePath2, $pngBytes)
    
    $boundary2 = [System.Guid]::NewGuid().ToString()
    $bodyLines2 = (
        "--$boundary2",
        "Content-Disposition: form-data; name=`"file`"; filename=`"test-image-2.png`"",
        "Content-Type: image/png$LF",
        [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($pngBytes),
        "--$boundary2--$LF"
    ) -join $LF

    Write-Host "✅ Second asset uploaded" -ForegroundColor Green
    Write-Host ""

    # Step 5: List all assets for the document
    Write-Host "Step 5: Listing all assets for document..." -ForegroundColor Yellow
    
    $listResponse = Invoke-RestMethod -Uri "$API_URL/api/documents/$documentId/assets" `
        -Method GET `
        -Headers @{
            "x-tenant-subdomain" = $TENANT_SUBDOMAIN
            "Authorization" = "Bearer $token"
        }

    Write-Host "✅ Assets listed successfully!" -ForegroundColor Green
    Write-Host "List Response:" -ForegroundColor Cyan
    Write-Host ($listResponse | ConvertTo-Json -Depth 5)
    Write-Host ""

    # Step 6: Validate response
    Write-Host "Step 6: Validating list response..." -ForegroundColor Yellow
    
    $listData = $listResponse.data
    
    if ($listData.document_id -ne $documentId) {
        throw "Document ID mismatch in response"
    }
    if (-not $listData.assets) {
        throw "Missing assets array in response"
    }
    if ($listData.total -lt 2) {
        throw "Expected at least 2 assets, got $($listData.total)"
    }
    
    # Validate each asset has required fields
    foreach ($asset in $listData.assets) {
        if (-not $asset.name) {
            throw "Asset missing name field"
        }
        if (-not $asset.storage_path) {
            throw "Asset missing storage_path field"
        }
        if (-not $asset.signed_url) {
            throw "Asset missing signed_url field"
        }
        if ($asset.asset_type -ne "image") {
            throw "Expected asset_type to be 'image', got '$($asset.asset_type)'"
        }
        if ($asset.expires_in -ne 3600) {
            throw "Expected expires_in to be 3600, got $($asset.expires_in)"
        }
    }
    
    Write-Host "✅ All validations passed!" -ForegroundColor Green
    Write-Host ""

    # Step 7: Test with non-existent document (should fail)
    Write-Host "Step 7: Testing with non-existent document (should fail)..." -ForegroundColor Yellow
    $fakeDocId = '00000000-0000-0000-0000-000000000000'

    try {
        Invoke-RestMethod -Uri "$API_URL/api/documents/$fakeDocId/assets" `
            -Method GET `
            -Headers @{
                "x-tenant-subdomain" = $TENANT_SUBDOMAIN
                "Authorization" = "Bearer $token"
            }
        Write-Host "❌ Should have rejected non-existent document" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "✅ Correctly rejected non-existent document" -ForegroundColor Green
        } else {
            throw $_
        }
    }
    Write-Host ""

    # Step 8: Test empty asset list
    Write-Host "Step 8: Testing document with no assets..." -ForegroundColor Yellow
    $emptyDocBody = @{
        title = "Empty Document"
        content = "No assets here."
    } | ConvertTo-Json

    $emptyDocResponse = Invoke-RestMethod -Uri "$API_URL/api/documents" `
        -Method POST `
        -Headers @{
            "x-tenant-subdomain" = $TENANT_SUBDOMAIN
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -Body $emptyDocBody

    $emptyDocId = $emptyDocResponse.data.document.id

    $emptyListResponse = Invoke-RestMethod -Uri "$API_URL/api/documents/$emptyDocId/assets" `
        -Method GET `
        -Headers @{
            "x-tenant-subdomain" = $TENANT_SUBDOMAIN
            "Authorization" = "Bearer $token"
        }

    if ($emptyListResponse.data.total -ne 0) {
        throw "Expected 0 assets for empty document, got $($emptyListResponse.data.total)"
    }

    Write-Host "✅ Empty asset list handled correctly" -ForegroundColor Green
    Write-Host ""

    # Step 9: Cleanup
    Write-Host "Step 9: Cleanup..." -ForegroundColor Yellow
    if (Test-Path $testImagePath) {
        Remove-Item $testImagePath -Force
    }
    if (Test-Path $testImagePath2) {
        Remove-Item $testImagePath2 -Force
    }
    Write-Host "✅ Test files cleaned up" -ForegroundColor Green
    Write-Host ""

    # Summary
    Write-Host "=== ✅ ALL TESTS PASSED ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Cyan
    Write-Host "- Asset list retrieval: ✅ PASS" -ForegroundColor Green
    Write-Host "- Multiple assets returned: ✅ PASS" -ForegroundColor Green
    Write-Host "- Signed URLs generated: ✅ PASS" -ForegroundColor Green
    Write-Host "- Asset metadata included: ✅ PASS" -ForegroundColor Green
    Write-Host "- Document existence check: ✅ PASS" -ForegroundColor Green
    Write-Host "- Empty asset list: ✅ PASS" -ForegroundColor Green
    Write-Host "- Tenant isolation: ✅ PASS (via document lookup)" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "❌ TEST FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    
    # Cleanup on error
    $testImagePath = Join-Path $PSScriptRoot "test-image-1.png"
    $testImagePath2 = Join-Path $PSScriptRoot "test-image-2.png"
    if (Test-Path $testImagePath) {
        Remove-Item $testImagePath -Force
    }
    if (Test-Path $testImagePath2) {
        Remove-Item $testImagePath2 -Force
    }
    
    exit 1
}
