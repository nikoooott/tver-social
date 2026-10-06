-- ТВЕРЬ Social v2 migration. Safe for the existing project: additive/idempotent.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  age integer,
  bio text default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text default '',
  image_url text,
  media_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check(follower_id<>following_id)
);

create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,post_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists bio text default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists media_urls jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists updated_at timestamptz;
alter table public.comments add column if not exists parent_id uuid;
alter table public.comments add column if not exists updated_at timestamptz;
alter table public.notifications add column if not exists comment_id uuid;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.messages add column if not exists read_at timestamptz;

-- The legacy project required image_url. Text-only posts must also be allowed.
alter table public.posts alter column image_url drop not null;

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists comments_post_id_idx on public.comments(post_id);
create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists notifications_user_idx on public.notifications(user_id,created_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id,created_at);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notifications enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Existing policy names are dropped before recreation so this migration is repeatable.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using(true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check(auth.uid()=id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select using(true);
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert with check(auth.uid()=user_id);
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete using(auth.uid()=user_id);

drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select using(true);
drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own on public.likes for insert with check(auth.uid()=user_id);
drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes for delete using(auth.uid()=user_id);

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using(true);
drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments for insert with check(auth.uid()=user_id);
drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments for delete using(auth.uid()=user_id);

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select using(true);
drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows for insert with check(auth.uid()=follower_id);
drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows for delete using(auth.uid()=follower_id);

drop policy if exists bookmarks_select_own on public.bookmarks;
create policy bookmarks_select_own on public.bookmarks for select using(auth.uid()=user_id);
drop policy if exists bookmarks_insert_own on public.bookmarks;
create policy bookmarks_insert_own on public.bookmarks for insert with check(auth.uid()=user_id);
drop policy if exists bookmarks_delete_own on public.bookmarks;
create policy bookmarks_delete_own on public.bookmarks for delete using(auth.uid()=user_id);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select using(auth.uid()=user_id);
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists notifications_insert_actor on public.notifications;
create policy notifications_insert_actor on public.notifications for insert with check(auth.uid()=actor_id);

-- Messaging: a member can see only their conversations/messages.
drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select using(exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()));
drop policy if exists conversations_insert_auth on public.conversations;
create policy conversations_insert_auth on public.conversations for insert with check(auth.uid() is not null);
drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member on public.conversation_members for select using(exists(select 1 from public.conversation_members mine where mine.conversation_id=conversation_id and mine.user_id=auth.uid()));
drop policy if exists conversation_members_insert_self on public.conversation_members;
create policy conversation_members_insert_self on public.conversation_members for insert with check(auth.uid()=user_id or exists(select 1 from public.conversation_members mine where mine.conversation_id=conversation_id and mine.user_id=auth.uid()));
drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select using(exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()));
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert with check(auth.uid()=user_id and exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()));
drop policy if exists messages_update_self on public.messages;
create policy messages_update_self on public.messages for update using(auth.uid()=user_id) with check(auth.uid()=user_id);

insert into storage.buckets(id,name,public) values('post-images','post-images',true) on conflict(id) do update set public=true;
drop policy if exists post_images_public_read on storage.objects;
create policy post_images_public_read on storage.objects for select using(bucket_id='post-images');
drop policy if exists post_images_auth_upload on storage.objects;
create policy post_images_auth_upload on storage.objects for insert with check(bucket_id='post-images' and auth.role()='authenticated');
drop policy if exists post_images_owner_delete on storage.objects;
create policy post_images_owner_delete on storage.objects for delete using(bucket_id='post-images' and owner_id=auth.uid()::text);

-- Realtime for chat. Safe if the tables are already in the publication.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Automatic notification events. They use SECURITY DEFINER only for writing the notification row.
create or replace function public.notify_like() returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; begin select user_id into owner_id from public.posts where id=new.post_id; if owner_id is not null and owner_id<>new.user_id then insert into public.notifications(user_id,actor_id,type,post_id) values(owner_id,new.user_id,'like',new.post_id); end if; return new; end; $$;
drop trigger if exists trg_notify_like on public.likes;
create trigger trg_notify_like after insert on public.likes for each row execute function public.notify_like();

create or replace function public.notify_follow() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.notifications(user_id,actor_id,type) values(new.following_id,new.follower_id,'follow'); return new; end; $$;
drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow after insert on public.follows for each row execute function public.notify_follow();

create or replace function public.notify_comment() returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; begin select user_id into owner_id from public.posts where id=new.post_id; if owner_id is not null and owner_id<>new.user_id then insert into public.notifications(user_id,actor_id,type,post_id,comment_id) values(owner_id,new.user_id,'comment',new.post_id,new.id); end if; return new; end; $$;
drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment after insert on public.comments for each row execute function public.notify_comment();

-- v3 product fields
alter table public.profiles add column if not exists city text default 'Тверь';
alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.posts add column if not exists view_count integer not null default 0;
create index if not exists profiles_full_name_idx on public.profiles(full_name);
create index if not exists profiles_last_seen_idx on public.profiles(last_seen desc);
create index if not exists posts_view_count_idx on public.posts(view_count desc);

-- Usernames are public handles, separate from display names. New usernames are lowercase.
do $$
begin
  create unique index profiles_username_lower_idx on public.profiles (lower(username)) where username is not null and username <> '';
exception when duplicate_table or duplicate_object then null;
end $$;

-- Keep conversation timestamps fresh when a message is sent.
create or replace function public.touch_conversation() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.conversations set updated_at=now() where id=new.conversation_id; return new; end; $$;
drop trigger if exists trg_touch_conversation on public.messages;
create trigger trg_touch_conversation after insert on public.messages for each row execute function public.touch_conversation();

-- Avoid recursive RLS evaluation for conversation membership checks.
create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=p_user_id);
$$;

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select using(public.is_conversation_member(id,auth.uid()));

drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member on public.conversation_members for select using(public.is_conversation_member(conversation_id,auth.uid()));

drop policy if exists conversation_members_insert_self on public.conversation_members;
create policy conversation_members_insert_self on public.conversation_members for insert with check(auth.uid()=user_id or public.is_conversation_member(conversation_id,auth.uid()));

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select using(public.is_conversation_member(conversation_id,auth.uid()));

drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert with check(auth.uid()=user_id and public.is_conversation_member(conversation_id,auth.uid()));


-- V3/V4: unique viewer tracking
CREATE TABLE IF NOT EXISTS public.post_views (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS post_views_select_authenticated ON public.post_views;
CREATE POLICY post_views_select_authenticated ON public.post_views FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.register_post_view(p_post_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  total integer := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  INSERT INTO public.post_views(post_id,user_id) VALUES(p_post_id,p_user_id)
  ON CONFLICT (post_id,user_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count > 0 THEN
    UPDATE public.posts SET view_count = COALESCE(view_count,0) + 1 WHERE id = p_post_id;
  END IF;
  SELECT COALESCE(view_count,0) INTO total FROM public.posts WHERE id=p_post_id;
  RETURN COALESCE(total,0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_post_view(uuid,uuid) TO authenticated;
CREATE INDEX IF NOT EXISTS post_views_post_idx ON public.post_views(post_id);
