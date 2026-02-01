# AWS Credentials Setup for DeepSeek Testing

## Current Issue

The `AWS_BEDROCK_API_KEY` in your `.env` file is not a valid AWS credential format. AWS Bedrock requires standard AWS IAM credentials.

## Solution

You need to replace the current `AWS_BEDROCK_API_KEY` with proper AWS credentials.

### Step 1: Get Your AWS Credentials

If you already have AWS credentials with Bedrock permissions, use those. Otherwise:

1. Go to AWS IAM Console: https://console.aws.amazon.com/iam/
2. Create a new user or use existing user
3. Attach policy: `AmazonBedrockFullAccess`
4. Generate access keys (Security credentials → Create access key)
5. Save the **Access Key ID** and **Secret Access Key**

### Step 2: Update backend/.env

Replace these lines in `backend/.env`:

```bash
# OLD (remove this):
AWS_BEDROCK_API_KEY=<redacted-old-api-key>

# NEW (add these):
AWS_ACCESS_KEY_ID=<your-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
AWS_REGION=eu-west-2
```

### Step 3: Enable Models in AWS Bedrock Console

1. Go to: https://console.aws.amazon.com/bedrock/
2. Select region: **eu-west-2 (London)**
3. Click "Model access" in left sidebar
4. Click "Manage model access" or "Edit"
5. Enable these models:
   - ✅ **DeepSeek V3** (deepseek.v3-v1:0)
   - ✅ **Claude Sonnet 4.5** (anthropic.claude-sonnet-4-5-20250929-v1:0)
6. Click "Save changes"
7. Wait for status to show "Access granted" (usually instant)

### Step 4: Run the Test

After updating your `.env` file with real AWS credentials:

```bash
cd backend
npx tsx src/test-aws-credentials.ts
```

## Expected Output

If successful, you should see:

```
============================================================
🧪 AWS Bedrock Test with Standard Credentials
============================================================

Configuration Check:
  AWS_ACCESS_KEY_ID: ✅ Set (AKIA...)
  AWS_SECRET_ACCESS_KEY: ✅ Set (********...)
  AWS_REGION: eu-west-2

Step 1: Initialize Bedrock Client
  ✅ Client initialized

Step 2: Test Claude Sonnet 4.5
  Calling Claude API...
  ✅ Claude API call successful
  Duration: 1234ms
  Response:
  ──────────────────────────────────────────────────────────
  [Haiku about AI will appear here]
  ──────────────────────────────────────────────────────────

Step 3: Test DeepSeek V3
  Calling DeepSeek API...
  ✅ DeepSeek API call successful
  Duration: 987ms
  Response:
  ──────────────────────────────────────────────────────────
  [Haiku about AI will appear here]
  ──────────────────────────────────────────────────────────

============================================================
📊 Test Summary
============================================================

✅ ALL TESTS PASSED

Results:
  ✅ Claude Sonnet 4.5: 1234ms
  ✅ DeepSeek V3: 987ms

Both models are operational and accessible!
```

## Troubleshooting

### Error: "Access Denied" (403)
- Model not enabled in Bedrock console (see Step 3 above)
- IAM user lacks `bedrock:InvokeModel` permission
- Model not available in your region

### Error: "Invalid credentials" (401)
- Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct
- Ensure no extra spaces or quotes in .env file

### Error: "Model not found" (404)
- Model ID incorrect
- Model not available in eu-west-2 region
- Check model is enabled in Bedrock console

## Files Updated

- ✅ `backend/.env.example` - Updated to use AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
- ✅ `backend/src/services/ai/bedrock.ts` - Updated to use standard AWS credentials
- ✅ `backend/src/test-aws-credentials.ts` - New comprehensive test script

## Next Steps

Once the test passes:
1. The DeepSeek API will be fully functional
2. All AI generation endpoints will work
3. You can proceed with application testing
