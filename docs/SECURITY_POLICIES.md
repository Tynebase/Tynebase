# TyneBase Security Policies

## Overview
This document outlines the Row Level Security (RLS) policies and access controls implemented across TyneBase to ensure strict tenant isolation and role-based access control.

## Documents Table Security

### RLS Status
✅ **ENABLED** - All access requires authentication and tenant membership

### Policies

#### Super Admin Access
- **Policy**: `super_admin_all_documents`
- **Access**: Full CRUD on all documents across all tenants
- **Condition**: User has `is_super_admin = TRUE`

#### User Access - View
- **Policy**: `users_view_tenant_documents`
- **Access**: SELECT documents in their tenant
- **Condition**: Document's `tenant_id` matches user's `tenant_id`

#### User Access - Create
- **Policy**: `users_create_tenant_documents`
- **Access**: INSERT documents in their tenant
- **Conditions**:
  - Document's `tenant_id` matches user's `tenant_id`
  - Document's `author_id` must be the authenticated user

#### User Access - Update Own
- **Policy**: `users_update_own_documents`
- **Access**: UPDATE their own documents
- **Conditions**:
  - Document's `author_id` matches authenticated user
  - Document's `tenant_id` matches user's `tenant_id`

#### Admin Access - Update
- **Policy**: `admins_update_tenant_documents`
- **Access**: UPDATE any document in their tenant
- **Conditions**:
  - User has `role = 'admin'`
  - Document's `tenant_id` matches admin's `tenant_id`

#### User Access - Delete Own
- **Policy**: `users_delete_own_documents`
- **Access**: DELETE their own documents
- **Conditions**:
  - Document's `author_id` matches authenticated user
  - Document's `tenant_id` matches user's `tenant_id`

#### Admin Access - Delete
- **Policy**: `admins_delete_tenant_documents`
- **Access**: DELETE any document in their tenant
- **Conditions**:
  - User has `role = 'admin'`
  - Document's `tenant_id` matches admin's `tenant_id`

---

## Templates Table Security

### RLS Status
✅ **ENABLED** - All access requires authentication

### Policies

#### Super Admin Access
- **Policy**: `super_admin_all_templates`
- **Access**: Full CRUD on all templates
- **Condition**: User has `is_super_admin = TRUE`

#### Public Templates - View
- **Policy**: `users_view_public_templates`
- **Access**: SELECT public approved templates
- **Conditions**:
  - Template has `visibility = 'public'`
  - Template has `is_approved = TRUE`

#### Tenant Templates - View
- **Policy**: `users_view_tenant_templates`
- **Access**: SELECT templates in their tenant
- **Condition**: Template's `tenant_id` matches user's `tenant_id`

#### Global Templates - View
- **Policy**: `users_view_global_templates`
- **Access**: SELECT global approved templates
- **Conditions**:
  - Template has `tenant_id IS NULL`
  - Template has `is_approved = TRUE`

#### User Access - Create
- **Policy**: `users_create_tenant_templates`
- **Access**: INSERT internal templates in their tenant
- **Conditions**:
  - Template's `tenant_id` matches user's `tenant_id`
  - Template's `created_by` must be the authenticated user
  - Template's `visibility = 'internal'` (users cannot create public templates)
  - Template's `is_approved = FALSE` (new templates start unapproved)

#### Admin Access - Create
- **Policy**: `admins_create_tenant_templates`
- **Access**: INSERT any template in their tenant
- **Conditions**:
  - User has `role = 'admin'`
  - Template's `tenant_id` matches admin's `tenant_id`
  - Template's `created_by` must be the authenticated user

#### User Access - Update Own
- **Policy**: `users_update_own_templates`
- **Access**: UPDATE their own unapproved internal templates
- **Conditions**:
  - Template's `created_by` matches authenticated user
  - Template's `tenant_id` matches user's `tenant_id`
  - Template has `is_approved = FALSE` (cannot edit approved templates)
  - Template must remain `visibility = 'internal'` (users cannot change to public)

#### Admin Access - Update
- **Policy**: `admins_update_tenant_templates`
- **Access**: UPDATE any template in their tenant
- **Conditions**:
  - User has `role = 'admin'`
  - Template's `tenant_id` matches admin's `tenant_id`

#### User Access - Delete Own
- **Policy**: `users_delete_own_templates`
- **Access**: DELETE their own unapproved templates
- **Conditions**:
  - Template's `created_by` matches authenticated user
  - Template's `tenant_id` matches user's `tenant_id`
  - Template has `is_approved = FALSE`

#### Admin Access - Delete
- **Policy**: `admins_delete_tenant_templates`
- **Access**: DELETE any template in their tenant
- **Conditions**:
  - User has `role = 'admin'`
  - Template's `tenant_id` matches admin's `tenant_id`

---

## Storage Bucket Security

### tenant-uploads Bucket
**Purpose**: Temporary uploads (videos, PDFs, etc.)

#### Policies
- **Insert**: Users can upload to `tenant-{tenant_id}/` folder only
- **Select**: Users can read from their tenant's folder only
- **Update**: Users can update files in their tenant's folder only
- **Delete**: Users can delete files from their tenant's folder only

**Path Format**: `tenant-{tenant_id}/filename.ext`

### tenant-documents Bucket
**Purpose**: Document assets (images, videos embedded in documents)

#### Policies
- **Insert**: Users can upload to `tenant-{tenant_id}/` folder only
- **Select**: Users can read from their tenant's folder only
- **Update**: Users can update files in their tenant's folder only
- **Delete**: Users can delete files from their tenant's folder only
- **Service Role**: Backend can manage all files (for processing)

**Path Format**: `tenant-{tenant_id}/document-{document_id}/filename.ext`

---

## Security Guarantees

### Tenant Isolation
✅ Users can **ONLY** access data within their own tenant
✅ Cross-tenant data leakage is **IMPOSSIBLE** at the database level
✅ Storage buckets enforce folder-based tenant isolation

### Role-Based Access Control
✅ Regular users can only modify their own documents/templates
✅ Admins can modify any content within their tenant
✅ Super admins have full access across all tenants

### Template Approval Workflow
✅ Users can only create internal templates (not public)
✅ New templates start as unapproved
✅ Only admins can approve templates or make them public
✅ Users cannot edit approved templates

### Storage Security
✅ All file paths must include tenant ID prefix
✅ Users cannot access files from other tenants
✅ Service role (backend) has full access for processing

---

## Migration Files

- `20260125065000_enable_rls.sql` - Core RLS for tenants and users
- `20260125070000_documents.sql` - Documents and templates tables
- `20260125077000_storage_buckets.sql` - Storage bucket policies
- `20260127210000_create_tenant_documents_bucket.sql` - Secure document assets bucket
- `20260127230000_secure_documents_templates.sql` - **NEW** Documents and templates RLS policies

---

## Testing Security

To verify tenant isolation:

```sql
-- As user in tenant A, try to access document from tenant B
SELECT * FROM documents WHERE tenant_id = '<tenant-b-id>';
-- Should return 0 rows

-- Try to insert document with different tenant_id
INSERT INTO documents (tenant_id, title, author_id, content)
VALUES ('<different-tenant-id>', 'Test', auth.uid(), 'content');
-- Should fail with RLS violation
```

---

## Last Updated
January 27, 2026 - All security policies applied and verified
