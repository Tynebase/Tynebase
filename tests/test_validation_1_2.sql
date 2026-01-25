-- Validation test for Task 1.2: Create Core Identity Tables
-- Insert test tenant
INSERT INTO tenants (subdomain, name, tier) 
VALUES ('test', 'Test Corp', 'free') 
RETURNING *;

-- Note: Cannot insert into users table yet as it requires auth.users entry
-- This will be tested in later tasks when auth is set up
