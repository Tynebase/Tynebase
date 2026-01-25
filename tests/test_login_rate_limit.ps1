$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:8080" }

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Task 2.9: Login Endpoint Validation                  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "=== Testing Login Rate Limit (5 attempts per 15 minutes) ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Target: POST $API_URL/api/auth/login"
Write-Host "Expected: 5 attempts allowed, then 429 rate limit"
Write-Host ""

$results = @()

for ($i = 1; $i -le 7; $i++) {
    Write-Host "Attempt $i..." -ForegroundColor White
    
    try {
        $response = Invoke-WebRequest -Uri "$API_URL/api/auth/login" `
            -Method POST `
            -Body '{"email":"test@example.com","password":"wrongpassword"}' `
            -ContentType "application/json" `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue `
            -ErrorVariable requestError
        
        $status = $response.StatusCode
        $rateLimitLimit = $response.Headers['X-RateLimit-Limit']
        $rateLimitRemaining = $response.Headers['X-RateLimit-Remaining']
        $rateLimitWindow = $response.Headers['X-RateLimit-Window']
        $retryAfter = $response.Headers['Retry-After']
        
        Write-Host "  Status: $status" -ForegroundColor Green
        Write-Host "  Rate Limit: $rateLimitRemaining/$rateLimitLimit remaining"
        Write-Host "  Window: ${rateLimitWindow}s"
        
        $results += @{
            Attempt = $i
            Status = $status
            Remaining = $rateLimitRemaining
            Limit = $rateLimitLimit
        }
        
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $rateLimitLimit = $_.Exception.Response.Headers['X-RateLimit-Limit']
        $rateLimitRemaining = $_.Exception.Response.Headers['X-RateLimit-Remaining']
        $rateLimitWindow = $_.Exception.Response.Headers['X-RateLimit-Window']
        $retryAfter = $_.Exception.Response.Headers['Retry-After']
        
        Write-Host "  Status: $status" -ForegroundColor $(if ($status -eq 429) { "Yellow" } else { "Red" })
        Write-Host "  Rate Limit: $rateLimitRemaining/$rateLimitLimit remaining"
        Write-Host "  Window: ${rateLimitWindow}s"
        
        if ($retryAfter) {
            Write-Host "  Retry After: ${retryAfter}s" -ForegroundColor Yellow
        }
        
        $results += @{
            Attempt = $i
            Status = $status
            Remaining = $rateLimitRemaining
            Limit = $rateLimitLimit
        }
        
        if ($status -eq 429) {
            Write-Host ""
            Write-Host "✅ Rate limit triggered at attempt $i (expected after 5 attempts)" -ForegroundColor Green
            break
        }
    }
    
    Write-Host ""
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Yellow
foreach ($r in $results) {
    $icon = if ($r.Status -eq 429) { "🚫" } elseif ($r.Status -eq 401) { "🔒" } else { "❓" }
    Write-Host "$icon Attempt $($r.Attempt): $($r.Status) - $($r.Remaining)/$($r.Limit) remaining"
}

$rateLimitedAttempt = $results | Where-Object { $_.Status -eq 429 } | Select-Object -First 1
if ($rateLimitedAttempt -and $rateLimitedAttempt.Attempt -eq 6) {
    Write-Host ""
    Write-Host "✅ PASS: Rate limit correctly enforced after 5 attempts" -ForegroundColor Green
    $testPassed = $true
} else {
    Write-Host ""
    Write-Host "❌ FAIL: Rate limit not working as expected" -ForegroundColor Red
    $testPassed = $false
}

Write-Host ""
Write-Host "=== Testing Invalid Credentials ===" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "$API_URL/api/auth/login" `
        -Method POST `
        -Body '{"email":"invalid@example.com","password":"wrongpass"}' `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction SilentlyContinue
    
    Write-Host "❌ FAIL: Expected 401 status" -ForegroundColor Red
    $invalidCredsPassed = $false
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401) {
        Write-Host "✅ PASS: Invalid credentials return 401" -ForegroundColor Green
        $invalidCredsPassed = $true
    } else {
        Write-Host "❌ FAIL: Expected 401, got $status" -ForegroundColor Red
        $invalidCredsPassed = $false
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Final Results                                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$rateLimitIcon = if ($testPassed) { "✅ PASS" } else { "❌ FAIL" }
$invalidCredsIcon = if ($invalidCredsPassed) { "✅ PASS" } else { "❌ FAIL" }

Write-Host "Rate Limiting:        $rateLimitIcon" -ForegroundColor $(if ($testPassed) { "Green" } else { "Red" })
Write-Host "Invalid Credentials:  $invalidCredsIcon" -ForegroundColor $(if ($invalidCredsPassed) { "Green" } else { "Red" })

$allPassed = $testPassed -and $invalidCredsPassed
Write-Host ""
Write-Host "Overall: $(if ($allPassed) { '✅ ALL TESTS PASSED' } else { '❌ SOME TESTS FAILED' })" -ForegroundColor $(if ($allPassed) { "Green" } else { "Red" })

exit $(if ($allPassed) { 0 } else { 1 })
