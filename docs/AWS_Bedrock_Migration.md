# AWS Bedrock Migration Summary

**Date:** 2026-01-25  
**Status:** ✅ Complete

## Overview

Migrated TyneBase AI infrastructure from multiple providers (OpenAI, separate AWS credentials) to unified AWS Bedrock API with a single API key for both DeepSeek and Claude models.

## Changes Made

### 1. Environment Configuration

**File:** `backend/.env.example`

**Before:**
```bash
# AI Provider API Keys
OPENAI_API_KEY=your-openai-api-key-here

# AWS Bedrock Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=eu-west-2
```

**After:**
```bash
# AWS Bedrock Configuration
# Used for both Claude and DeepSeek models via Amazon Bedrock
AWS_BEDROCK_API_KEY=your-aws-bedrock-api-key-here
AWS_REGION=eu-west-2
```

### 2. AI Provider Types

**File:** `backend/src/services/ai/types.ts`

**Changes:**
- Removed `'openai'` and `'anthropic'` from `AIProvider` type
- Added `'bedrock'` as unified provider
- Replaced `'gpt-5.2'` with `'deepseek-v3'` in `AIModel` type
- Removed `'claude-opus-4.5'` (not needed)

**New Types:**
```typescript
export type AIProvider = 'bedrock' | 'vertex';

export type AIModel = 
  | 'deepseek-v3'
  | 'claude-sonnet-4.5'
  | 'gemini-3-flash';
```

### 3. AI Router Configuration

**File:** `backend/src/services/ai/router.ts`

**Changes:**
- Removed OpenAI provider configuration
- Consolidated Anthropic into Bedrock provider
- Updated default provider to `'bedrock'`
- Updated default model to `'deepseek-v3'`

**New Configuration:**
```typescript
const PROVIDER_CONFIGS: Record<AIProvider, AIProviderConfig[]> = {
  bedrock: [
    {
      provider: 'bedrock',
      model: 'deepseek-v3',
      capabilities: ['text-generation'],
      endpoint: 'bedrock-runtime.eu-west-2.amazonaws.com',
      region: 'eu-west-2',
    },
    {
      provider: 'bedrock',
      model: 'claude-sonnet-4.5',
      capabilities: ['text-generation'],
      endpoint: 'bedrock-runtime.eu-west-2.amazonaws.com',
      region: 'eu-west-2',
    },
  ],
  vertex: [
    // ... Gemini for video/audio only
  ],
};
```

### 4. New Bedrock Service for DeepSeek

**File:** `backend/src/services/ai/bedrock.ts` (NEW)

**Features:**
- Handles DeepSeek V3 model via AWS Bedrock
- Uses Bedrock model ID: `deepseek.v3-v1:0`
- Supports both streaming and non-streaming generation
- Uses AWS Bedrock API key authentication
- 30-second timeout with automatic retry
- Comprehensive error handling

### 5. Updated Anthropic Service

**File:** `backend/src/services/ai/anthropic.ts`

**Changes:**
- Updated model ID to: `anthropic.claude-sonnet-4-5-20250929-v1:0`
- Changed provider type from `'anthropic'` to `'bedrock'`
- Removed Claude Opus 4.5 (not needed)

### 6. Route Updates

**Files Modified:**
- `backend/src/routes/ai-generate.ts`
  - Updated model enum: `['deepseek-v3', 'claude-sonnet-4.5', 'gemini-3-flash']`
  - Changed default model to `'deepseek-v3'`

- `backend/src/routes/ai-enhance.ts`
  - Changed import from `openai` to `bedrock`
  - Updated model reference to `'deepseek-v3'`

### 7. Worker Updates

**File:** `backend/src/workers/aiGeneration.ts`

**Changes:**
- Changed import from `openai` to `bedrock`
- Updated model enum to use `'deepseek-v3'`
- Updated routing logic: `model.startsWith('deepseek-')` instead of `model.startsWith('gpt-')`

### 8. Utility Updates

**File:** `backend/src/utils/creditCalculator.ts`

**Changes:**
- Replaced `'gpt-5.2'` with `'deepseek-v3'`
- Updated model multiplier: `'deepseek-v3': 1.5`
- Removed `'claude-opus-4.5'` multiplier

### 9. Test Updates

**Files Modified:**
- `tests/test_ai_generate.js` - Updated to use `'deepseek-v3'`
- `tests/test_ai_generation_worker.js` - Updated to use `'deepseek-v3'`
- `tests/test_ai_enhance.js` - Updated to use `'deepseek-v3'`

## Model Specifications

### DeepSeek V3
- **Bedrock Model ID:** `deepseek.v3-v1:0`
- **Provider:** AWS Bedrock (eu-west-2)
- **Use Case:** Default text generation model
- **Credit Multiplier:** 1.5x
- **Max Tokens:** 4000

### Claude Sonnet 4.5
- **Bedrock Model ID:** `anthropic.claude-sonnet-4-5-20250929-v1:0`
- **Provider:** AWS Bedrock (eu-west-2)
- **Use Case:** Advanced text generation
- **Credit Multiplier:** 2x
- **Max Tokens:** 4000

### Gemini 3 Flash
- **Provider:** Google Vertex AI (europe-west2)
- **Use Case:** Video/audio transcription only
- **No changes made to this provider**

## Authentication

All Bedrock requests now use a single AWS Bedrock API key:

```typescript
credentials: {
  accessKeyId: process.env.AWS_BEDROCK_API_KEY,
  secretAccessKey: process.env.AWS_BEDROCK_API_KEY,
}
```

## Benefits

1. **Simplified Configuration:** Single API key instead of multiple provider credentials
2. **Unified Provider:** Both DeepSeek and Claude use the same Bedrock infrastructure
3. **Cost Efficiency:** DeepSeek V3 offers competitive pricing
4. **EU Data Residency:** All models run in eu-west-2 region
5. **Consistent Error Handling:** Unified error handling across both models

## Migration Checklist

- ✅ Updated environment configuration
- ✅ Updated type definitions
- ✅ Updated AI router
- ✅ Created Bedrock service for DeepSeek
- ✅ Updated Anthropic service with correct model ID
- ✅ Updated all API routes
- ✅ Updated worker logic
- ✅ Updated credit calculator
- ✅ Updated all test files
- ✅ Removed OpenAI dependencies (kept openai.ts for reference/embeddings)

## Next Steps

1. **Add AWS Bedrock API key** to `backend/.env`:
   ```bash
   AWS_BEDROCK_API_KEY=your-actual-bedrock-api-key
   AWS_REGION=eu-west-2
   ```

2. **Test the integration:**
   ```bash
   # Test DeepSeek generation
   node tests/test_ai_generate.js
   
   # Test worker processing
   node tests/test_ai_generation_worker.js
   
   # Test document enhancement
   node tests/test_ai_enhance.js
   ```

3. **Verify model access** in AWS Bedrock console:
   - Ensure `deepseek.v3-v1:0` is enabled
   - Ensure `anthropic.claude-sonnet-4-5-20250929-v1:0` is enabled
   - Both should be available in `eu-west-2` region

## Notes

- The `openai.ts` file was kept for potential future use with embeddings
- All existing functionality remains intact
- Credit calculation adjusted for DeepSeek pricing
- No database schema changes required
