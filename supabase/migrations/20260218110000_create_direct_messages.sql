-- Direct Messages Tables for Milestone 3
-- Full-fledged DM system with conversations and participants

-- DM Conversations (represents a DM thread between 2+ users)
CREATE TABLE dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT, -- Optional name for group DMs, NULL for 1:1
  is_group BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DM Participants (who is in each conversation)
CREATE TABLE dm_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT FALSE,
  UNIQUE(conversation_id, user_id)
);

-- DM Messages
CREATE TABLE dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DM Reactions
CREATE TABLE dm_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes for performance
CREATE INDEX idx_dm_conversations_tenant ON dm_conversations(tenant_id);
CREATE INDEX idx_dm_conversations_updated ON dm_conversations(tenant_id, updated_at DESC);
CREATE INDEX idx_dm_participants_conversation ON dm_participants(conversation_id);
CREATE INDEX idx_dm_participants_user ON dm_participants(user_id);
CREATE INDEX idx_dm_messages_conversation ON dm_messages(conversation_id);
CREATE INDEX idx_dm_messages_created ON dm_messages(conversation_id, created_at DESC);
CREATE INDEX idx_dm_messages_tenant ON dm_messages(tenant_id);
CREATE INDEX idx_dm_reactions_message ON dm_reactions(message_id);

-- Enable RLS
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dm_conversations
-- Users can only see conversations they are a participant of
CREATE POLICY "dm_conversations_select" ON dm_conversations
  FOR SELECT USING (
    id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
  );

-- Any authenticated user in tenant can create a conversation
CREATE POLICY "dm_conversations_insert" ON dm_conversations
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Only creator can update conversation (for group name changes)
CREATE POLICY "dm_conversations_update" ON dm_conversations
  FOR UPDATE USING (
    created_by = auth.uid()
  );

-- RLS Policies for dm_participants
-- Users can see participants of conversations they're in
CREATE POLICY "dm_participants_select" ON dm_participants
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
  );

-- Users can add participants to conversations they created
CREATE POLICY "dm_participants_insert" ON dm_participants
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM dm_conversations WHERE created_by = auth.uid()
    )
    OR user_id = auth.uid() -- Users can add themselves
  );

-- Users can update their own participant record (mute, last_read)
CREATE POLICY "dm_participants_update" ON dm_participants
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- RLS Policies for dm_messages
-- Users can see messages in conversations they're part of
CREATE POLICY "dm_messages_select" ON dm_messages
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
  );

-- Users can send messages to conversations they're part of
CREATE POLICY "dm_messages_insert" ON dm_messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
  );

-- Users can edit their own messages
CREATE POLICY "dm_messages_update" ON dm_messages
  FOR UPDATE USING (
    author_id = auth.uid()
  );

-- Users can delete their own messages
CREATE POLICY "dm_messages_delete" ON dm_messages
  FOR DELETE USING (
    author_id = auth.uid()
  );

-- RLS Policies for dm_reactions
-- Users can see reactions on messages they can see
CREATE POLICY "dm_reactions_select" ON dm_reactions
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM dm_messages 
      WHERE conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
    )
  );

-- Users can add reactions to messages they can see
CREATE POLICY "dm_reactions_insert" ON dm_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND message_id IN (
      SELECT id FROM dm_messages 
      WHERE conversation_id IN (SELECT conversation_id FROM dm_participants WHERE user_id = auth.uid())
    )
  );

-- Users can remove their own reactions
CREATE POLICY "dm_reactions_delete" ON dm_reactions
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- Function to update conversation updated_at when a message is sent
CREATE OR REPLACE FUNCTION update_dm_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dm_conversations 
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_dm_conversation_timestamp
  AFTER INSERT ON dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_dm_conversation_timestamp();

-- Function to find or create a 1:1 DM conversation
CREATE OR REPLACE FUNCTION find_or_create_dm_conversation(
  p_tenant_id UUID,
  p_user1_id UUID,
  p_user2_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Find existing 1:1 conversation between these two users
  SELECT c.id INTO v_conversation_id
  FROM dm_conversations c
  WHERE c.tenant_id = p_tenant_id
    AND c.is_group = FALSE
    AND EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = c.id AND user_id = p_user1_id)
    AND EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = c.id AND user_id = p_user2_id)
    AND (SELECT COUNT(*) FROM dm_participants WHERE conversation_id = c.id) = 2
  LIMIT 1;

  -- If found, return it
  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- Create new conversation
  INSERT INTO dm_conversations (tenant_id, is_group, created_by)
  VALUES (p_tenant_id, FALSE, p_user1_id)
  RETURNING id INTO v_conversation_id;

  -- Add both participants
  INSERT INTO dm_participants (conversation_id, user_id)
  VALUES 
    (v_conversation_id, p_user1_id),
    (v_conversation_id, p_user2_id);

  RETURN v_conversation_id;
END;
$$;

-- Enable realtime for dm_messages
ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_reactions;
