-- ТВЕРЬ Social 3.0 schema
-- Safe to run on a fresh project. The cleanup section clears app demo/content data.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[A-Za-zА-Яа-яЁё0-9_.]{3,24}$'),
  display_name text not null default 'Пользователь' check (char_length(display_name) between 1 and 40),
  age integer check (age between 13 and 120),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null default '' check (char_length(text) <= 2000),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(text)) > 0 or image_url is not null)
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','follow')),
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists comments_post_id_idx on public.comments(post_id, created_at);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.set_updated_at() returns trigger
language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at before update on public.posts for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  candidate text;
  i integer := 0;
begin
  base_username := coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(coalesce(new.email,''),'@',1));
  base_username := regexp_replace(lower(base_username), '[^a-zа-яё0-9_.]', '', 'g');
  if char_length(base_username) < 3 then base_username := 'user'; end if;
  candidate := left(base_username, 24);
  while exists(select 1 from public.profiles where username = candidate) loop
    i := i + 1;
    candidate := left(base_username, 24 - char_length(i::text)) || i::text;
  end loop;
  insert into public.profiles(id, username, display_name, age, bio)
  values(new.id, candidate,
         coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'Пользователь'),
         nullif(new.raw_user_meta_data->>'age','')::integer,
         '');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Notification triggers
create or replace function public.notify_like() returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications(user_id, actor_id, type, post_id) values(owner,new.user_id,'like',new.post_id);
  end if;
  return new;
end; $$;
drop trigger if exists like_notification on public.likes;
create trigger like_notification after insert on public.likes for each row execute function public.notify_like();

create or replace function public.notify_comment() returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications(user_id, actor_id, type, post_id) values(owner,new.user_id,'comment',new.post_id);
  end if;
  return new;
end; $$;
drop trigger if exists comment_notification on public.comments;
create trigger comment_notification after insert on public.comments for each row execute function public.notify_comment();

create or replace function public.notify_follow() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id, actor_id, type) values(new.following_id,new.follower_id,'follow');
  return new;
end; $$;
drop trigger if exists follow_notification on public.follows;
create trigger follow_notification after insert on public.follows for each row execute function public.notify_follow();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notifications enable row level security;

-- Recreate policies idempotently
DO $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('profiles','posts','likes','comments','follows','bookmarks','notifications') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy profiles_select on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy posts_select on public.posts for select using (true);
create policy posts_insert on public.posts for insert with check (auth.uid() = user_id);
create policy posts_update on public.posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy posts_delete on public.posts for delete using (auth.uid() = user_id);

create policy likes_select on public.likes for select using (true);
create policy likes_insert on public.likes for insert with check (auth.uid() = user_id);
create policy likes_delete on public.likes for delete using (auth.uid() = user_id);

create policy comments_select on public.comments for select using (true);
create policy comments_insert on public.comments for insert with check (auth.uid() = user_id);
create policy comments_delete on public.comments for delete using (auth.uid() = user_id);

create policy follows_select on public.follows for select using (true);
create policy follows_insert on public.follows for insert with check (auth.uid() = follower_id);
create policy follows_delete on public.follows for delete using (auth.uid() = follower_id);

create policy bookmarks_select on public.bookmarks for select using (auth.uid() = user_id);
create policy bookmarks_insert on public.bookmarks for insert with check (auth.uid() = user_id);
create policy bookmarks_delete on public.bookmarks for delete using (auth.uid() = user_id);

create policy notifications_select on public.notifications for select using (auth.uid() = user_id);
create policy notifications_update on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notifications_delete on public.notifications for delete using (auth.uid() = user_id);

-- Storage: public images, write/delete only inside the uploader's own folder.
insert into storage.buckets(id, name, public) values ('post-images','post-images',true) on conflict (id) do update set public=true;
insert into storage.buckets(id, name, public) values ('avatars','avatars',true) on conflict (id) do update set public=true;

drop policy if exists post_images_read on storage.objects;
drop policy if exists post_images_insert on storage.objects;
drop policy if exists post_images_delete on storage.objects;
drop policy if exists avatars_read on storage.objects;
drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_delete on storage.objects;

create policy post_images_read on storage.objects for select using (bucket_id='post-images');
create policy post_images_insert on storage.objects for insert to authenticated with check (bucket_id='post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_images_delete on storage.objects for delete to authenticated using (bucket_id='post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_read on storage.objects for select using (bucket_id='avatars');
create policy avatars_insert on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Remove old demo/application content. This does NOT delete Supabase Auth users.
-- If you created test users in Authentication -> Users, delete those test users there too.
delete from public.notifications;
delete from public.bookmarks;
delete from public.comments;
delete from public.likes;
delete from public.follows;
delete from public.posts;
delete from public.profiles where id not in (select id from auth.users);
