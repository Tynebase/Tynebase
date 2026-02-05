-- Migration: Create notifications table for user notification system
-- Description: Stores user notifications with support for different types, read status, and action URLs

-- Create notification type enum
CREATE TYPE public.notification_type AS ENUM ('document', 'comment', 'mention', 'system', 'ai');

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  description TEXT,
  action_url TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_tenant_id ON public.notifications(tenant_id);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy: Users can only update their own notifications (for marking as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policy: System can insert notifications for any user
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE public.notifications IS 'User notifications for document updates, comments, mentions, and system events';
COMMENT ON COLUMN public.notifications.action_url IS 'URL to navigate to when notification is clicked';
COMMENT ON COLUMN public.notifications.metadata IS 'Additional JSON data for the notification (document_id, comment_id, etc.)';
