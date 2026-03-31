-- Migration: Expand notifications system for production
-- Description: Adds new notification types (billing, task, chat, credits, invoice, invitation),
--              creates notification_preferences table, and adds a server-side helper function.

-- ============================================================================
-- 1. EXPAND NOTIFICATION TYPE ENUM
-- ============================================================================
-- Postgres enums require ALTER TYPE ... ADD VALUE (cannot be inside a transaction block in some versions)
-- Using IF NOT EXISTS for idempotency

DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'billing';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'task';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'chat';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'credits';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'invoice';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'invitation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. ADD priority AND category COLUMNS TO notifications
-- ============================================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

-- Add check constraint for priority values
DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT chk_notification_priority
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index on priority for filtering urgent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority) WHERE priority IN ('high', 'urgent');

-- Composite index for efficient dashboard queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON public.notifications(user_id, read, created_at DESC);

-- ============================================================================
-- 3. CREATE notification_preferences TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Per-type toggles (all enabled by default)
  document_enabled BOOLEAN NOT NULL DEFAULT true,
  comment_enabled BOOLEAN NOT NULL DEFAULT true,
  mention_enabled BOOLEAN NOT NULL DEFAULT true,
  system_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  billing_enabled BOOLEAN NOT NULL DEFAULT true,
  task_enabled BOOLEAN NOT NULL DEFAULT true,
  chat_enabled BOOLEAN NOT NULL DEFAULT true,
  credits_enabled BOOLEAN NOT NULL DEFAULT true,
  invoice_enabled BOOLEAN NOT NULL DEFAULT true,
  invitation_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Delivery channels
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Quiet hours (optional)
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences(user_id);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage notification preferences" ON public.notification_preferences;
CREATE POLICY "System can manage notification preferences" ON public.notification_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. ENABLE REALTIME ON notifications TABLE
-- ============================================================================
-- This allows Supabase Realtime subscriptions for live notification updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================
COMMENT ON TABLE public.notification_preferences IS 'Per-user notification delivery preferences and quiet hours';
COMMENT ON COLUMN public.notifications.priority IS 'Notification urgency: low, normal, high, urgent';
COMMENT ON COLUMN public.notifications.category IS 'Grouping category for notification filtering (general, workspace, billing, security)';
