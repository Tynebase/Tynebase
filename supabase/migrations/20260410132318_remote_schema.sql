create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

drop extension if exists "pg_net";

alter table "public"."audit_logs" drop constraint "audit_logs_actor_id_fkey";

alter table "public"."chat_channels" drop constraint "chat_channels_created_by_fkey";

alter table "public"."chat_messages" drop constraint "chat_messages_author_id_fkey";

alter table "public"."chat_reactions" drop constraint "chat_reactions_user_id_fkey";

alter table "public"."chat_read_receipts" drop constraint "chat_read_receipts_user_id_fkey";

alter table "public"."collection_documents" drop constraint "collection_documents_added_by_fkey";

alter table "public"."collection_members" drop constraint "collection_members_invited_by_fkey";

alter table "public"."collection_members" drop constraint "collection_members_user_id_fkey";

alter table "public"."discussion_likes" drop constraint "discussion_likes_user_id_fkey";

alter table "public"."discussion_reply_likes" drop constraint "discussion_reply_likes_user_id_fkey";

alter table "public"."discussion_views" drop constraint "discussion_views_user_id_fkey";

alter table "public"."dm_participants" drop constraint "dm_participants_user_id_fkey";

alter table "public"."dm_reactions" drop constraint "dm_reactions_user_id_fkey";

alter table "public"."document_lineage" drop constraint "document_lineage_actor_id_fkey";

alter table "public"."document_reviews" drop constraint "document_reviews_assigned_to_fkey";

alter table "public"."document_reviews" drop constraint "document_reviews_created_by_fkey";

alter table "public"."document_shares" drop constraint "document_shares_shared_with_fkey";

alter table "public"."document_versions" drop constraint "document_versions_created_by_fkey";

alter table "public"."notifications" drop constraint "notifications_user_id_fkey";

alter table "public"."poll_votes" drop constraint "poll_votes_user_id_fkey";

alter table "public"."query_usage" drop constraint "query_usage_user_id_fkey";

alter table "public"."tags" drop constraint "tags_created_by_fkey";

alter table "public"."templates" drop constraint "templates_created_by_fkey";

alter table "public"."categories" drop constraint "categories_author_id_fkey";

alter table "public"."chat_assignments" drop constraint "chat_assignments_assigned_by_fkey";

alter table "public"."chat_assignments" drop constraint "chat_assignments_assigned_to_fkey";

alter table "public"."collections" drop constraint "collections_author_id_fkey";

alter table "public"."discussion_replies" drop constraint "discussion_replies_author_id_fkey";

alter table "public"."discussions" drop constraint "discussions_author_id_fkey";

alter table "public"."dm_conversations" drop constraint "dm_conversations_created_by_fkey";

alter table "public"."dm_messages" drop constraint "dm_messages_author_id_fkey";

alter table "public"."document_shares" drop constraint "document_shares_created_by_fkey";

alter table "public"."documents" drop constraint "documents_author_id_fkey";

alter table "public"."notification_preferences" drop constraint "notification_preferences_user_id_fkey";

alter table "public"."workspace_invites" drop constraint "workspace_invites_invited_by_fkey";

alter table "public"."users" drop constraint "users_pkey";

drop index if exists "public"."users_pkey";

CREATE UNIQUE INDEX users_email_tenant_key ON public.users USING btree (email, tenant_id);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id, tenant_id);

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."users" add constraint "users_email_tenant_key" UNIQUE using index "users_email_tenant_key";

alter table "public"."categories" add constraint "categories_author_id_fkey" FOREIGN KEY (author_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."categories" validate constraint "categories_author_id_fkey";

alter table "public"."chat_assignments" add constraint "chat_assignments_assigned_by_fkey" FOREIGN KEY (assigned_by, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."chat_assignments" validate constraint "chat_assignments_assigned_by_fkey";

alter table "public"."chat_assignments" add constraint "chat_assignments_assigned_to_fkey" FOREIGN KEY (assigned_to, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."chat_assignments" validate constraint "chat_assignments_assigned_to_fkey";

alter table "public"."collections" add constraint "collections_author_id_fkey" FOREIGN KEY (author_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."collections" validate constraint "collections_author_id_fkey";

alter table "public"."discussion_replies" add constraint "discussion_replies_author_id_fkey" FOREIGN KEY (author_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."discussion_replies" validate constraint "discussion_replies_author_id_fkey";

alter table "public"."discussions" add constraint "discussions_author_id_fkey" FOREIGN KEY (author_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."discussions" validate constraint "discussions_author_id_fkey";

alter table "public"."dm_conversations" add constraint "dm_conversations_created_by_fkey" FOREIGN KEY (created_by, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."dm_conversations" validate constraint "dm_conversations_created_by_fkey";

alter table "public"."dm_messages" add constraint "dm_messages_author_id_fkey" FOREIGN KEY (author_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."dm_messages" validate constraint "dm_messages_author_id_fkey";

alter table "public"."document_shares" add constraint "document_shares_created_by_fkey" FOREIGN KEY (created_by, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."document_shares" validate constraint "document_shares_created_by_fkey";

alter table "public"."documents" add constraint "documents_author_id_fkey" FOREIGN KEY (author_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."documents" validate constraint "documents_author_id_fkey";

alter table "public"."notification_preferences" add constraint "notification_preferences_user_id_fkey" FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE CASCADE not valid;

alter table "public"."notification_preferences" validate constraint "notification_preferences_user_id_fkey";

alter table "public"."workspace_invites" add constraint "workspace_invites_invited_by_fkey" FOREIGN KEY (invited_by, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL not valid;

alter table "public"."workspace_invites" validate constraint "workspace_invites_invited_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_default_chat_channels(p_tenant_id uuid, p_created_by uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO chat_channels (tenant_id, name, description, created_by)
  VALUES 
    (p_tenant_id, 'general', 'General discussion for the team', p_created_by),
    (p_tenant_id, 'announcements', 'Important team announcements', p_created_by),
    (p_tenant_id, 'random', 'Off-topic conversations and fun', p_created_by)
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.decrement_discussion_replies_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE discussions 
  SET replies_count = GREATEST(0, replies_count - 1), updated_at = NOW()
  WHERE id = OLD.discussion_id;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_or_create_dm_conversation(p_tenant_id uuid, p_user1_id uuid, p_user2_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN auth.uid();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_tenant_storage_usage(tenant_id_param uuid)
 RETURNS TABLE(total_bytes bigint, document_count integer, asset_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  asset_total INTEGER := 0;
  asset_bytes BIGINT := 0;
  doc_bytes BIGINT := 0;
  tenant_bucket_prefix TEXT;
BEGIN
  -- Build the tenant bucket prefix pattern
  tenant_bucket_prefix := 'tenant-' || tenant_id_param::text || '-%';

  -- Get asset count and total bytes from storage.objects
  -- Check BOTH patterns:
  -- 1. Per-tenant buckets: tenant-{uuid}-uploads, tenant-{uuid}-documents
  -- 2. Shared buckets with path prefix: tenant-uploads/tenant-{uuid}/...
  SELECT 
    COALESCE(COUNT(*)::INTEGER, 0),
    COALESCE(SUM(
      CASE 
        WHEN metadata ? 'size' THEN (metadata->>'size')::BIGINT
        WHEN metadata->>'size' IS NOT NULL THEN (metadata->>'size')::BIGINT
        ELSE 0::BIGINT
      END
    ), 0::BIGINT)
  INTO asset_total, asset_bytes
  FROM storage.objects
  WHERE 
    -- Pattern 1: Per-tenant buckets (tenant-{uuid}-uploads, tenant-{uuid}-documents)
    bucket_id LIKE tenant_bucket_prefix
    OR
    -- Pattern 2: Shared buckets with tenant path prefix
    (bucket_id IN ('tenant-uploads', 'tenant-documents', 'tenant-videos', 'tenant-assets')
     AND name LIKE format('tenant-%s/%%', tenant_id_param::text));

  -- Get document content bytes (content + yjs_state)
  SELECT COALESCE(
    (SELECT SUM(
      OCTET_LENGTH(COALESCE(content, '')) + 
      OCTET_LENGTH(COALESCE(yjs_state::text, ''))
    )::BIGINT
     FROM public.documents
     WHERE tenant_id = tenant_id_param),
    0::BIGINT
  ) INTO doc_bytes;

  RETURN QUERY
  SELECT
    (doc_bytes + asset_bytes) AS total_bytes,
    COALESCE(
      (SELECT COUNT(*)::INTEGER
       FROM public.documents
       WHERE tenant_id = tenant_id_param),
      0
    ) AS document_count,
    asset_total AS asset_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN (
    SELECT tenant_id FROM public.users
    WHERE users.id = auth.uid()
    LIMIT 1
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_discussion_replies_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE discussions 
  SET replies_count = replies_count + 1, updated_at = NOW()
  WHERE id = NEW.discussion_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.is_super_admin = TRUE
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(tenant_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.tenant_id = tenant_uuid
    AND users.role = 'admin'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_direct_lineage_modification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Allow cascade deletes (triggered by document deletion)
  -- Block direct deletes (when not triggered by cascade)
  IF TG_OP = 'DELETE' THEN
    -- Check if this is a cascade delete by verifying the document still exists
    -- If document doesn't exist, this is a cascade delete - allow it
    IF NOT EXISTS (SELECT 1 FROM public.documents WHERE id = OLD.document_id) THEN
      RETURN OLD; -- Allow cascade delete
    END IF;
    -- Document still exists, so this is a direct delete attempt - block it
    RAISE EXCEPTION 'Document lineage records are immutable and cannot be directly deleted';
  END IF;
  
  -- Block all updates
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Document lineage records are immutable and cannot be modified';
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_lineage_modification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Document lineage records are immutable and cannot be modified or deleted';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_categories_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_collections_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_credit_pools_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_discussion_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_dm_conversation_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE dm_conversations 
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_poll_votes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_reply_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_tags_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_consents_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


