-- Migration: Add user profile fields for notification preferences and regional settings
-- Created: 2026-02-06

-- Add new columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email_notifications": true,
  "push_notifications": true,
  "weekly_digest": false,
  "marketing_emails": false
}'::jsonb,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Add comments for documentation
COMMENT ON COLUMN public.users.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN public.users.notification_preferences IS 'User notification preferences as JSON (email_notifications, push_notifications, weekly_digest, marketing_emails)';
COMMENT ON COLUMN public.users.language IS 'User preferred language code (e.g., en, es, fr, de)';
COMMENT ON COLUMN public.users.timezone IS 'User preferred timezone (e.g., UTC, EST, PST, GMT, CET)';

-- Create index on language for analytics/segmentation
CREATE INDEX IF NOT EXISTS idx_users_language ON public.users(language);
