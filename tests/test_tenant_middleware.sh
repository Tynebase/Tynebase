#!/bin/bash

# Test Tenant Context Middleware Validation Script
# Task 2.3 Validation Requirements:
# 1. Send request with header, verify request.tenant populated
# 2. Try invalid subdomain - returns 404

echo "=== Testing Tenant Context Middleware ==="
echo ""

BASE_URL="http://localhost:8080"

echo "Test 1: Request WITHOUT x-tenant-subdomain header (should return 400)"
curl -s -X GET "$BASE_URL/api/test/tenant" | jq .
echo ""

echo "Test 2: Request with INVALID subdomain (should return 404)"
curl -s -X GET "$BASE_URL/api/test/tenant" \
  -H "x-tenant-subdomain: nonexistent-tenant-xyz" | jq .
echo ""

echo "Test 3: Request with VALID subdomain (should return 200 with tenant data)"
echo "Note: This requires a tenant to exist in the database"
echo "You can create one with: INSERT INTO tenants (subdomain, name, tier) VALUES ('test', 'Test Corp', 'free');"
curl -s -X GET "$BASE_URL/api/test/tenant" \
  -H "x-tenant-subdomain: test" | jq .
echo ""

echo "Test 4: Request with INVALID characters in subdomain (should sanitize and return 404 or 200 if exists)"
curl -s -X GET "$BASE_URL/api/test/tenant" \
  -H "x-tenant-subdomain: test@#$%^&*()" | jq .
echo ""

echo "Test 5: Second request with same subdomain (should use cache)"
curl -s -X GET "$BASE_URL/api/test/tenant" \
  -H "x-tenant-subdomain: test" | jq .
echo ""

echo "=== Validation Complete ==="
