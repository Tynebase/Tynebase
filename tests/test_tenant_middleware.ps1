# Test Tenant Context Middleware Validation Script
# Task 2.3 Validation Requirements:
# 1. Send request with header, verify request.tenant populated
# 2. Try invalid subdomain - returns 404

Write-Host "=== Testing Tenant Context Middleware ===" -ForegroundColor Cyan
Write-Host ""

$BASE_URL = "http://localhost:8080"

Write-Host "Test 1: Request WITHOUT x-tenant-subdomain header (should return 400)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/test/tenant" -Method Get -ErrorAction Stop
    $response | ConvertTo-Json
} catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    $_.Exception.Response | ConvertTo-Json
}
Write-Host ""

Write-Host "Test 2: Request with INVALID subdomain (should return 404)" -ForegroundColor Yellow
try {
    $headers = @{ "x-tenant-subdomain" = "nonexistent-tenant-xyz" }
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/test/tenant" -Method Get -Headers $headers -ErrorAction Stop
    $response | ConvertTo-Json
} catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}
Write-Host ""

Write-Host "Test 3: Request with VALID subdomain (should return 200 with tenant data)" -ForegroundColor Yellow
Write-Host "Note: This requires a tenant to exist in the database" -ForegroundColor Gray
Write-Host "You can create one with: INSERT INTO tenants (subdomain, name, tier) VALUES ('test', 'Test Corp', 'free');" -ForegroundColor Gray
try {
    $headers = @{ "x-tenant-subdomain" = "test" }
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/test/tenant" -Method Get -Headers $headers -ErrorAction Stop
    $response | ConvertTo-Json
} catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}
Write-Host ""

Write-Host "Test 4: Request with INVALID characters in subdomain (should sanitize)" -ForegroundColor Yellow
try {
    $headers = @{ "x-tenant-subdomain" = "test@#$%^&*()" }
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/test/tenant" -Method Get -Headers $headers -ErrorAction Stop
    $response | ConvertTo-Json
} catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}
Write-Host ""

Write-Host "Test 5: Second request with same subdomain (should use cache)" -ForegroundColor Yellow
try {
    $headers = @{ "x-tenant-subdomain" = "test" }
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/test/tenant" -Method Get -Headers $headers -ErrorAction Stop
    $response | ConvertTo-Json
} catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Validation Complete ===" -ForegroundColor Cyan
