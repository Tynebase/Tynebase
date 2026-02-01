-- Move vector extension from public schema to extensions schema
-- This improves security and organization by keeping extensions separate

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Move the vector extension to extensions schema
ALTER EXTENSION vector SET SCHEMA extensions;

-- Ensure the extensions schema is in the search_path for proper function resolution
-- This allows using vector types without schema prefix
ALTER DATABASE postgres SET search_path = public, extensions;

-- Also set for current session
SET search_path TO public, extensions;
