-- Community Forum Tables for Milestone 3 Objective O3
-- Discussions, replies, views, likes, and polls

-- Discussions table
CREATE TABLE discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Announcements','Questions','Ideas','General')),
  author_id UUID NOT NULL REFERENCES users(id),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  replies_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  likes_count INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussion replies table
CREATE TABLE discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES discussion_replies(id),
  is_accepted_answer BOOLEAN DEFAULT FALSE,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussion views (for unique view counting)
CREATE TABLE discussion_views (
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (discussion_id, user_id)
);

-- Discussion likes
CREATE TABLE discussion_likes (
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (discussion_id, user_id)
);

-- Reply likes
CREATE TABLE discussion_reply_likes (
  reply_id UUID NOT NULL REFERENCES discussion_replies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (reply_id, user_id)
);

-- Polls table
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poll options
CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  votes_count INT DEFAULT 0
);

-- Poll votes
CREATE TABLE poll_votes (
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  option_id UUID NOT NULL REFERENCES poll_options(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_discussions_tenant ON discussions(tenant_id);
CREATE INDEX idx_discussions_author ON discussions(author_id);
CREATE INDEX idx_discussions_category ON discussions(tenant_id, category);
CREATE INDEX idx_discussions_created ON discussions(tenant_id, created_at DESC);
CREATE INDEX idx_discussions_pinned ON discussions(tenant_id, is_pinned DESC, created_at DESC);
CREATE INDEX idx_discussion_replies_discussion ON discussion_replies(discussion_id);
CREATE INDEX idx_discussion_replies_author ON discussion_replies(author_id);
CREATE INDEX idx_discussion_replies_created ON discussion_replies(discussion_id, created_at ASC);
CREATE INDEX idx_discussion_views_discussion ON discussion_views(discussion_id);
CREATE INDEX idx_discussion_likes_discussion ON discussion_likes(discussion_id);
CREATE INDEX idx_polls_discussion ON polls(discussion_id);
CREATE INDEX idx_poll_options_poll ON poll_options(poll_id);
CREATE INDEX idx_poll_votes_poll ON poll_votes(poll_id);

-- Enable RLS
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_reply_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discussions
-- Members can view discussions in their tenant
CREATE POLICY "discussions_select" ON discussions
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Members can create discussions in their tenant
CREATE POLICY "discussions_insert" ON discussions
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND author_id = auth.uid()
  );

-- Users can update their own discussions, admins/editors can update any
CREATE POLICY "discussions_update" ON discussions
  FOR UPDATE USING (
    author_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'editor')
    )
  );

-- Users can delete their own discussions, admins can delete any
CREATE POLICY "discussions_delete" ON discussions
  FOR DELETE USING (
    author_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for discussion_replies
CREATE POLICY "discussion_replies_select" ON discussion_replies
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "discussion_replies_insert" ON discussion_replies
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND author_id = auth.uid()
  );

CREATE POLICY "discussion_replies_update" ON discussion_replies
  FOR UPDATE USING (
    author_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'editor')
    )
  );

CREATE POLICY "discussion_replies_delete" ON discussion_replies
  FOR DELETE USING (
    author_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for discussion_views
CREATE POLICY "discussion_views_select" ON discussion_views
  FOR SELECT USING (
    discussion_id IN (
      SELECT id FROM discussions 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "discussion_views_insert" ON discussion_views
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- RLS Policies for discussion_likes
CREATE POLICY "discussion_likes_select" ON discussion_likes
  FOR SELECT USING (
    discussion_id IN (
      SELECT id FROM discussions 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "discussion_likes_insert" ON discussion_likes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "discussion_likes_delete" ON discussion_likes
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- RLS Policies for discussion_reply_likes
CREATE POLICY "discussion_reply_likes_select" ON discussion_reply_likes
  FOR SELECT USING (
    reply_id IN (
      SELECT id FROM discussion_replies 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "discussion_reply_likes_insert" ON discussion_reply_likes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "discussion_reply_likes_delete" ON discussion_reply_likes
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- RLS Policies for polls
CREATE POLICY "polls_select" ON polls
  FOR SELECT USING (
    discussion_id IN (
      SELECT id FROM discussions 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "polls_insert" ON polls
  FOR INSERT WITH CHECK (
    discussion_id IN (
      SELECT id FROM discussions 
      WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
      AND author_id = auth.uid()
    )
  );

-- RLS Policies for poll_options
CREATE POLICY "poll_options_select" ON poll_options
  FOR SELECT USING (
    poll_id IN (
      SELECT id FROM polls WHERE discussion_id IN (
        SELECT id FROM discussions 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "poll_options_insert" ON poll_options
  FOR INSERT WITH CHECK (
    poll_id IN (
      SELECT p.id FROM polls p
      JOIN discussions d ON d.id = p.discussion_id
      WHERE d.tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
      AND d.author_id = auth.uid()
    )
  );

-- RLS Policies for poll_votes
CREATE POLICY "poll_votes_select" ON poll_votes
  FOR SELECT USING (
    poll_id IN (
      SELECT id FROM polls WHERE discussion_id IN (
        SELECT id FROM discussions 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "poll_votes_insert" ON poll_votes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "poll_votes_delete" ON poll_votes
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- Function to increment replies_count when a reply is added
CREATE OR REPLACE FUNCTION increment_discussion_replies_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE discussions 
  SET replies_count = replies_count + 1, updated_at = NOW()
  WHERE id = NEW.discussion_id;
  RETURN NEW;
END;
$$;

-- Function to decrement replies_count when a reply is deleted
CREATE OR REPLACE FUNCTION decrement_discussion_replies_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE discussions 
  SET replies_count = GREATEST(0, replies_count - 1), updated_at = NOW()
  WHERE id = OLD.discussion_id;
  RETURN OLD;
END;
$$;

-- Triggers for replies_count
CREATE TRIGGER trigger_increment_replies_count
  AFTER INSERT ON discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION increment_discussion_replies_count();

CREATE TRIGGER trigger_decrement_replies_count
  AFTER DELETE ON discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION decrement_discussion_replies_count();

-- Function to update likes_count on discussions
CREATE OR REPLACE FUNCTION update_discussion_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussions SET likes_count = likes_count + 1 WHERE id = NEW.discussion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussions SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.discussion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_discussion_likes
  AFTER INSERT OR DELETE ON discussion_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_discussion_likes_count();

-- Function to update likes_count on replies
CREATE OR REPLACE FUNCTION update_reply_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussion_replies SET likes_count = likes_count + 1 WHERE id = NEW.reply_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussion_replies SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.reply_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_reply_likes
  AFTER INSERT OR DELETE ON discussion_reply_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_reply_likes_count();

-- Function to update poll option votes_count
CREATE OR REPLACE FUNCTION update_poll_votes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE poll_options SET votes_count = votes_count + 1 WHERE id = NEW.option_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE poll_options SET votes_count = GREATEST(0, votes_count - 1) WHERE id = OLD.option_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_poll_votes
  AFTER INSERT OR DELETE ON poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_votes_count();

-- Enable realtime for discussions (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE discussions;
ALTER PUBLICATION supabase_realtime ADD TABLE discussion_replies;
