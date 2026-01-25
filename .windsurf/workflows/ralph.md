---
description: Run a RALPH development loop for autonomous AI-to-AI task execution
---

# RALPH Development Loop Workflow

This workflow executes the RALPH (Rapid Autonomous Loop for Programmatic Handling) protocol for TyneBase Milestone 2.

## Prerequisites
- Working directory: `RALPH_milestone2_build_docs/`
- Files: `PRD.md`, `RALPH.md`, `PRD.json`, `ralph_state.json`, `ralph_runner.py`
- **Supabase CLI**: Access via `npx supabase <command>` (no global install needed)
- **Real Credentials Available**: `backend/.env` contains actual Supabase credentials for testing
- **Test Infrastructure**: `/tests` directory contains validation scripts and test data

---

## ⚠️ CRITICAL: Supabase Authentication (READ THIS FIRST)

**TyneBase has migrated to the NEW Supabase API keys. You MUST use the new authentication flow.**

### ✅ CORRECT - Use New API Keys:
```typescript
// In backend code - ALWAYS import from lib/supabase
import { supabaseAdmin } from '../lib/supabase';

// The supabaseAdmin client automatically uses:
// - SUPABASE_SECRET_KEY (new format: sb_secret_...)
// - Falls back to SUPABASE_SERVICE_ROLE_KEY (deprecated)
```

### ❌ DEPRECATED - Never Use Old Keys Directly:
```typescript
// ❌ NEVER DO THIS - Old pattern is deprecated
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = createClient(url, process.env.SUPABASE_ANON_KEY);
```

### Implementation Rules:
1. **Backend Routes**: ALWAYS import `supabaseAdmin` from `../lib/supabase`
2. **Test Scripts**: Use `SUPABASE_SECRET_KEY` from `backend/.env`
3. **Frontend**: Use `SUPABASE_PUBLISHABLE_KEY` (not ANON_KEY)
4. **Never**: Create new Supabase clients with old key variables
5. **Reference**: See `docs/Supabase_API_Key_Migration.md` for full details

### Why This Matters:
- ✅ New keys can be rotated independently without downtime
- ✅ Better security and observability
- ✅ Shorter, more secure key format
- ✅ Browser detection prevents accidental secret key exposure
- ❌ Old JWT-based keys are deprecated and will be removed

**If you create any new files that use Supabase, follow the existing pattern in the codebase.**

---

## Testing Infrastructure

**Location:** All test files are in `/tests` directory

**Available Test Scripts:**
- `insert_test_tenant.js` - Creates test tenant in database (Node.js)
- `validate_credits.js` - Validates credit tracking system
- `validate_pgvector.js` - Validates pgvector extension and embeddings
- `validate_embeddings.sql` - SQL validation for embeddings table
- `test_tenant_insert.sql` - SQL script for test tenant creation
- `test_validation_1_X.sql` - Database validation scripts for Phase 1 tasks

**Running Tests:**

All tests should be run from the **project root directory**:

```bash
# Node.js tests (require backend/.env with real credentials)
node tests/insert_test_tenant.js
node tests/validate_credits.js
node tests/validate_pgvector.js

# SQL tests (use Supabase dashboard SQL editor)
# Copy/paste content from tests/test_validation_1_X.sql files
```

**Important Notes:**
- ✅ `backend/.env` has real Supabase credentials (service role + anon key)
- ✅ Test tenant exists: subdomain `test`, ID `1521f0ae-4db7-4110-a993-c494535d9b00`
- ✅ All validation scripts can be run against remote database
- ✅ Use these scripts to verify database migrations and API functionality

---

## Supabase Commands Reference

All Supabase CLI commands use `npx supabase`:

| Command | Description |
|---------|-------------|
| `npx supabase status` | Check local Supabase status |
| `npx supabase projects list` | List all linked projects |
| `npx supabase db push` | Push migrations to remote database (PREFERRED) |
| `npx supabase db reset` | Reset LOCAL database and run all migrations |
| `npx supabase migration list` | List all migrations |

**For database tasks**: 
- Migrations are in `supabase/migrations/`
- **ALWAYS use `npx supabase db push` to test on remote database**
- Remote database is linked: **TyneBase DB** (fsybthuvikyetueizado)
- Local testing with `db reset` is optional, but remote push is REQUIRED for validation

---

## Step 1: Check Current Status

// turbo
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py status
```

Review the current state before proceeding.

---

## Step 2: Get Next Task

// turbo
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py next
```

Read the task details carefully.

---

## Step 3: Start the Task

Replace `TASK_ID` with the actual task ID (e.g., `1.1`):

```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py start TASK_ID
```

---

## Step 4: Consult PRD Documentation

Before implementing, read the relevant section in:
- `RALPH_milestone2_build_docs/PRD.md` - Full requirements and context
- `RALPH_milestone2_build_docs/RALPH.md` - Detailed task description with validation steps

Look for:
- **Action**: What to implement
- **Validation**: How to verify it works
- **Security**: Security considerations

---

## Step 5: Implement the Feature

Follow the RALPH coding standards:
- TypeScript strict mode
- Error handling with try-catch
- Input validation with Zod
- JSDoc comments
- Meaningful variable names
- RLS policies on all tables
- Never commit secrets

---

## Step 6: Push to Remote Database (For DB Tasks)

**For database migration tasks ONLY**, push to remote database:

// turbo
```bash
npx supabase db push
```

Verify the output shows successful migration application. This tests against the **actual production-linked database**.

---

## Step 7: Run Validation

Execute the validation steps specified in the task. Paste actual output, not "it worked".

**For database tasks**: 

1. **Primary validation**: `npx supabase db push` succeeds without errors
2. **Schema verification**: Use schema dump to verify all components created:

```bash
npx supabase db dump --schema public --data-only=false | Select-String -Pattern "table_name|function_name" -Context 2,2
```

Replace `table_name|function_name` with the actual names you're validating (e.g., `credit_pools|query_usage|deduct_credits`).

This confirms:
- ✅ Tables created with correct schema
- ✅ Indexes created
- ✅ RLS enabled
- ✅ RLS policies created
- ✅ Functions/triggers created
- ✅ Foreign key constraints
- ✅ Check constraints

**Alternative validation methods**:
- Create a `test_validation_X_X.sql` file with test queries
- Use Supabase dashboard SQL editor to run validation queries
- Query system tables directly (pg_class, pg_indexes, pg_constraint, etc.)

---

## Step 8: Create Execution Summary

Create file `RALPH_milestone2_build_docs/execution_summaries/execution_summary_taskX_X.md`:

```markdown
# Execution Summary - Task [X.X]: [Task Name]

**Status:** ✅ PASS / ❌ FAIL  
**Completed:** [timestamp]  
**Validation:** [PASS/FAIL]

## What Was Implemented
[Brief description]

## Files Created/Modified
- `path/to/file.ts` - [what changed]

## Validation Results
[paste actual output]

## Security Considerations
- [List measures applied]

## Notes for Supervisor
[Anything important]
```

---

## Step 9: Mark Task Complete

If validation PASSED:
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py pass TASK_ID
```

If validation FAILED (after 2 retries):
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py fail TASK_ID
```

---

## Step 10: Commit Changes

Stage and commit with proper message format:

```bash
git add .
git commit -m "feat(task-X.X): [clear description under 50 chars]"
```

Record the commit:
```bash
cd RALPH_milestone2_build_docs && python ralph_runner.py commit "feat(task-X.X): description"
```

---

## Step 11: Push to Staging Branch

```bash
git push origin ralph/milestone2-staging
```

---

## Step 12: Report to Supervisor

Stop and report:
- Task ID and title
- Status (PASS/FAIL)
- Summary of changes
- Any concerns or questions

---

## When to STOP

❌ **STOP immediately if:**
- Validation fails after 2 retry attempts
- Ambiguity in PRD requirements (mark task with [?])
- Missing external dependencies (API keys, credentials)
- Security concern you're unsure about
- Architectural decision needed

---

## Quick Commands Reference

| Command | Description |
|---------|-------------|
| `python ralph_runner.py status` | Show current state |
| `python ralph_runner.py next` | Get next task details |
| `python ralph_runner.py start X.X` | Start a task |
| `python ralph_runner.py pass X.X` | Mark task passed |
| `python ralph_runner.py fail X.X` | Mark task blocked |
| `python ralph_runner.py summary` | Show progress by phase |
| `python ralph_runner.py commit "msg"` | Record a commit |

---

## Loop Continuation

After completing a task and reporting, say:
> "Continue RALPH loop" or "/ralph"

To run the next iteration.
