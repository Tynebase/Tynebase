# TyneBase Test Infrastructure

This directory contains all validation and test scripts for the TyneBase backend.

## Prerequisites

- **Real Supabase Credentials**: Ensure `backend/.env` has valid `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- **Node.js**: Required for JavaScript test scripts
- **Supabase CLI**: Access via `npx supabase <command>`

## Test Files

### Node.js Test Scripts

These scripts require real Supabase credentials from `backend/.env`:

- **`insert_test_tenant.js`** - Creates/updates test tenant in database
  ```bash
  cd tests && node insert_test_tenant.js
  ```
  Creates tenant with subdomain `test`, ID `1521f0ae-4db7-4110-a993-c494535d9b00`

- **`validate_credits.js`** - Validates credit tracking system (Task 1.10)
  ```bash
  node tests/validate_credits.js
  ```

- **`validate_pgvector.js`** - Validates pgvector extension and embeddings (Task 1.5, 1.6)
  ```bash
  node tests/validate_pgvector.js
  ```

### SQL Validation Scripts

These can be run via Supabase CLI or dashboard SQL editor:

- **`test_tenant_insert.sql`** - SQL script to insert test tenant
- **`validate_embeddings.sql`** - Validates embeddings table structure
- **`test_validation_1_X.sql`** - Phase 1 task validation scripts
  - `test_validation_1_2.sql` - Validates identity tables (tenants, users)
  - `test_validation_1_3.sql` - Validates RLS policies
  - `test_validation_1_4.sql` - Validates documents and templates tables
  - `test_validation_1_5.sql` - Validates pgvector extension
  - `test_validation_1_6.sql` - Validates embeddings table and indexes
  - `test_validation_1_7.sql` - Validates job queue infrastructure
  - `test_validation_1_8.sql` - Validates document lineage table
  - `test_validation_1_9.sql` - Validates user consents table
  - `test_validation_1_10.sql` - Validates credit tracking tables
  - `test_validation_1_11.sql` - Validates storage buckets
  - `test_validation_1_12.sql` - Validates hybrid search RPC function

**Running SQL tests:**
```bash
# Via Supabase CLI (not supported with --file flag)
# Use dashboard SQL editor instead, or:
cat tests/test_validation_1_X.sql | npx supabase db execute
```

## Test Tenant Information

A test tenant is available for validation:
- **Subdomain**: `test`
- **ID**: `1521f0ae-4db7-4110-a993-c494535d9b00`
- **Name**: Test Corporation
- **Tier**: free
- **Settings**: `{"ai_provider": "openai"}`

## Usage in RALPH Workflow

When implementing tasks, use these scripts to validate your work:

1. **Database tasks**: Run corresponding `test_validation_1_X.sql` script
2. **API tasks**: Use `insert_test_tenant.js` to ensure test data exists
3. **Credit system**: Use `validate_credits.js` to verify credit tracking
4. **Embeddings**: Use `validate_pgvector.js` and `validate_embeddings.sql`

## Notes

- All Node.js scripts use `@supabase/supabase-js` and require `dotenv`
- SQL scripts can be run directly in Supabase dashboard SQL editor
- Test tenant is persistent and shared across validation runs
- Scripts are idempotent where possible (use UPSERT, ON CONFLICT, etc.)
