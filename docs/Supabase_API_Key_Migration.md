# Supabase API Key Migration Guide

**Status:** 🚧 Pending Implementation  
**Priority:** High  
**Impact:** Backend authentication system

## Overview

Supabase is deprecating the old JWT-based `anon` and `service_role` keys in favor of new `sb_publishable_` and `sb_secret_` API keys. This migration is necessary to improve security, enable independent key rotation, and follow Supabase's recommended best practices.

## Current State

TyneBase currently uses:
- **`SUPABASE_ANON_KEY`**: JWT-based key for client-side operations
- **`SUPABASE_SERVICE_ROLE_KEY`**: JWT-based key for server-side operations

These keys are:
- ❌ Tightly coupled to the JWT secret
- ❌ Cannot be independently rotated without downtime
- ❌ Have 10-year expiry duration
- ❌ Self-referential and contain redundant information
- ❌ Large and difficult to parse securely

## Target State

Migrate to:
- **`SUPABASE_PUBLISHABLE_KEY`**: New publishable key (format: `sb_publishable_...`)
- **`SUPABASE_SECRET_KEY`**: New secret key (format: `sb_secret_...`)

Benefits:
- ✅ Independent rotation without downtime
- ✅ Shorter, more secure key format
- ✅ Better logging and security practices
- ✅ Improved observability
- ✅ Browser detection for secret keys (prevents accidental exposure)

## Migration Plan

### Phase 1: Add New Keys (Zero Downtime)

1. **Generate new keys in Supabase Dashboard**
   - Navigate to Project Settings → API Keys
   - Click "Create new API Keys"
   - Copy the `sb_publishable_...` and `sb_secret_...` keys

2. **Update environment configuration**
   - Add new keys to `.env` files
   - Keep old keys active during transition
   - Update `backend/src/config/env.ts` to support both key sets

3. **Update Supabase client initialization**
   - Modify `backend/src/lib/supabase.ts` to use new secret key
   - Maintain backward compatibility during transition

### Phase 2: Update Client Code

1. **Backend services** (use `sb_secret_...`)
   - `backend/src/lib/supabase.ts` - Admin client
   - All route handlers using `supabaseAdmin`
   - Background jobs and workers
   - Collab server authentication

2. **Frontend services** (use `sb_publishable_...`)
   - Frontend Supabase client initialization
   - Public API calls
   - Client-side authentication flows

3. **Test scripts** (use appropriate key)
   - Update all test scripts in `/tests` directory
   - Use secret key for admin operations
   - Use publishable key for user operations

### Phase 3: Validation & Monitoring

1. **Test all endpoints**
   - Run full test suite
   - Verify authentication flows
   - Check impersonation endpoint
   - Validate super admin operations

2. **Monitor usage in Supabase Dashboard**
   - Check "Last Used" indicators for old keys
   - Confirm new keys are being used
   - Monitor for any errors or 401/403 responses

### Phase 4: Deactivate Old Keys

1. **Confirm zero usage of old keys**
   - Wait 24-48 hours after deployment
   - Check Supabase Dashboard for last used timestamps
   - Review application logs for any issues

2. **Deactivate old keys**
   - Use Supabase Dashboard API Keys page
   - Deactivate (don't delete) old `anon` and `service_role` keys
   - Keep them deactivated for 7 days before deletion

3. **Remove old keys from codebase**
   - Remove `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from env files
   - Update env schema validation
   - Remove any references in documentation

## Implementation Details

### Environment Variables

**Current:**
```env
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**During Transition:**
```env
# Old keys (keep active during migration)
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# New keys (preferred)
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

**After Migration:**
```env
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

### Code Changes Required

#### 1. `backend/src/config/env.ts`
```typescript
const envSchema = z.object({
  // ... other fields
  SUPABASE_URL: z.string().url(),
  
  // New keys (required after migration)
  SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_'),
  
  // Old keys (optional during transition, remove after migration)
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // ... other fields
});
```

#### 2. `backend/src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY, // Changed from SUPABASE_SERVICE_ROLE_KEY
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

#### 3. Frontend Supabase Client
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! // Changed from ANON_KEY
);
```

#### 4. Test Scripts
Update all test scripts in `/tests` directory to use new keys:
```javascript
require('dotenv').config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY; // Changed

const supabase = createClient(supabaseUrl, supabaseSecretKey);
```

## Known Limitations

1. **Edge Functions**: Only support JWT verification via old keys
   - Use `--no-verify-jwt` option with new keys
   - Implement custom apikey-header authorization in Edge Function code

2. **Realtime Connections**: Limited to 24 hours with publishable key
   - Unless upgraded with user-level authentication
   - Use Supabase Auth or Third-Party Auth provider

3. **CLI/Self-Hosting**: New keys only available on hosted platform
   - Continue using JWT-based keys for local development
   - API Gateway component not available in CLI

## Security Considerations

### Secret Key Handling

**DO:**
- ✅ Only use in backend components (servers, Edge Functions, microservices)
- ✅ Store in encrypted environment variables
- ✅ Use separate secret keys for different backend components
- ✅ Rotate immediately if compromised
- ✅ Log only first 6 characters for debugging

**DON'T:**
- ❌ Never expose in browser (even on localhost)
- ❌ Never commit to source control
- ❌ Never send via chat, email, or SMS
- ❌ Never pass in URLs or query params
- ❌ Never use on devices you don't own/control

### Publishable Key Handling

**DO:**
- ✅ Safe to expose in web pages, mobile apps, CLI tools
- ✅ Use with Row Level Security enabled
- ✅ Regularly review RLS policies
- ✅ Monitor Security Advisor in Supabase Dashboard

**DON'T:**
- ❌ Don't rely on obfuscation for security
- ❌ Don't modify `anon` or `authenticated` role attributes without understanding implications

## Rollback Plan

If issues arise after migration:

1. **Immediate rollback**:
   - Re-activate old JWT-based keys in Supabase Dashboard
   - Revert environment variables to use old keys
   - Redeploy with old configuration

2. **Investigate issues**:
   - Check application logs for authentication errors
   - Review Supabase Dashboard for API errors
   - Test specific endpoints that are failing

3. **Fix and retry**:
   - Address root cause
   - Test thoroughly in development
   - Re-attempt migration with fixes

## Testing Checklist

Before deactivating old keys, verify:

- [ ] All authentication flows work (login, signup, logout)
- [ ] Super admin operations function correctly
- [ ] Tenant impersonation endpoint works
- [ ] Document operations (create, read, update, delete)
- [ ] AI operations (generate, enhance, RAG queries)
- [ ] File uploads and storage access
- [ ] Collaboration server authentication
- [ ] Background jobs and workers
- [ ] All test scripts pass
- [ ] No 401/403 errors in production logs
- [ ] Supabase Dashboard shows new keys being used

## Timeline

- **Week 1**: Generate new keys, update environment configuration
- **Week 2**: Update backend code, deploy to staging
- **Week 3**: Update frontend code, comprehensive testing
- **Week 4**: Deploy to production, monitor for 48 hours
- **Week 5**: Deactivate old keys, final cleanup

## References

- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys)
- [Migration Announcement](https://supabase.com/blog/new-api-keys)
- [Security Best Practices](https://supabase.com/docs/guides/api/securing-your-api)

## Questions & Support

For questions or issues during migration:
1. Check Supabase Dashboard Security Advisor
2. Review application logs for specific errors
3. Consult Supabase Discord community
4. Contact Supabase support for platform-specific issues
