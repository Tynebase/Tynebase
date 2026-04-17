-- Migration: Fix document_lineage document_id to allow NULL
-- Purpose: The foreign key was changed to ON DELETE SET NULL, but the column itself is still NOT NULL
-- This causes errors when trying to insert lineage records for deleted documents

BEGIN;

-- Drop the foreign key constraint
ALTER TABLE public.document_lineage 
DROP CONSTRAINT IF EXISTS document_lineage_document_id_fkey;

-- Make document_id nullable
ALTER TABLE public.document_lineage 
ALTER COLUMN document_id DROP NOT NULL;

-- Re-add the foreign key with ON DELETE SET NULL
ALTER TABLE public.document_lineage
ADD CONSTRAINT document_lineage_document_id_fkey 
FOREIGN KEY (document_id) 
REFERENCES public.documents(id) 
ON DELETE SET NULL;

COMMIT;
