-- Team Chat Tables for Milestone 3 Objective O2
-- Slack-style persistent team chat with channels, messages, reactions, and read receipts

-- Chat Channels
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Chat Messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES chat_messages(id),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Reactions
CREATE TABLE chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Chat Read Receipts (for unread indicators)
CREATE TABLE chat_read_receipts (
  user_id UUID NOT NULL REFERENCES users(id),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

-- Indexes for performance
CREATE INDEX idx_chat_channels_tenant ON chat_channels(tenant_id);
CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX idx_chat_messages_tenant ON chat_messages(tenant_id);
CREATE INDEX idx_chat_messages_parent ON chat_messages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_chat_messages_created ON chat_messages(channel_id, created_at DESC);
CREATE INDEX idx_chat_reactions_message ON chat_reactions(message_id);
CREATE INDEX idx_chat_read_receipts_channel ON chat_read_receipts(channel_id);

-- Enable RLS
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_channels
-- Members can view channels in their tenant
CREATE POLICY "chat_channels_select" ON chat_channels
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Only admins can create channels
CREATE POLICY "chat_channels_insert" ON chat_channels
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Only admins can update channels
CREATE POLICY "chat_channels_update" ON chat_channels
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Only admins can delete channels
CREATE POLICY "chat_channels_delete" ON chat_channels
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for chat_messages
-- Members can view messages in their tenant
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Members can insert messages in their tenant
CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND author_id = auth.uid()
  );

-- Users can update their own messages, admins can update any
CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE USING (
    author_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Users can delete their own messages, admins can delete any
CREATE POLICY "chat_messages_delete" ON chat_messages
  FOR DELETE USING (
    author_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for chat_reactions
-- Members can view reactions in their tenant (via message join)
CREATE POLICY "chat_reactions_select" ON chat_reactions
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM chat_messages 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- Members can add reactions
CREATE POLICY "chat_reactions_insert" ON chat_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND message_id IN (
      SELECT id FROM chat_messages 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- Users can only delete their own reactions
CREATE POLICY "chat_reactions_delete" ON chat_reactions
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- RLS Policies for chat_read_receipts
-- Users can view their own read receipts
CREATE POLICY "chat_read_receipts_select" ON chat_read_receipts
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Users can insert/update their own read receipts
CREATE POLICY "chat_read_receipts_insert" ON chat_read_receipts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "chat_read_receipts_update" ON chat_read_receipts
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- Function to create default channels for a tenant
CREATE OR REPLACE FUNCTION create_default_chat_channels(p_tenant_id UUID, p_created_by UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO chat_channels (tenant_id, name, description, created_by)
  VALUES 
    (p_tenant_id, 'general', 'General discussion for the team', p_created_by),
    (p_tenant_id, 'announcements', 'Important team announcements', p_created_by),
    (p_tenant_id, 'random', 'Off-topic conversations and fun', p_created_by)
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$$;

-- Enable realtime for chat_messages (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
