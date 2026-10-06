-- ТВЕРЬ SOCIAL: вставь этот SQL в Supabase -> SQL Editor -> Run

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  name text not null default 'Пользователь',
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check (follower_id <> following_id)
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles own insert" on public.profiles for insert with check (auth.uid()=id);
create policy "profiles own update" on public.profiles for update using (auth.uid()=id);

create policy "posts public read" on public.posts for select using (true);
create policy "posts own insert" on public.posts for insert with check (auth.uid()=user_id);
create policy "posts own update" on public.posts for update using (auth.uid()=user_id);
create policy "posts own delete" on public.posts for delete using (auth.uid()=user_id);

create policy "likes public read" on public.likes for select using (true);
create policy "likes own insert" on public.likes for insert with check (auth.uid()=user_id);
create policy "likes own delete" on public.likes for delete using (auth.uid()=user_id);

create policy "comments public read" on public.comments for select using (true);
create policy "comments own insert" on public.comments for insert with check (auth.uid()=user_id);
create policy "comments own update" on public.comments for update using (auth.uid()=user_id);
create policy "comments own delete" on public.comments for delete using (auth.uid()=user_id);

create policy "follows public read" on public.follows for select using (true);
create policy "follows own insert" on public.follows for insert with check (auth.uid()=follower_id);
create policy "follows own delete" on public.follows for delete using (auth.uid()=follower_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,name,username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name','Пользователь'),
    lower(regexp_replace(coalesce(new.raw_user_meta_data->>'name','user') || '_' || substr(new.id::text,1,5),'[^a-zA-Z0-9_]+','','g'))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Фото можно хранить в Storage bucket "post-images".
insert into storage.buckets (id,name,public)
values ('post-images','post-images',true)
on conflict (id) do nothing;

create policy "public read post images" on storage.objects for select using (bucket_id='post-images');
create policy "users upload post images" on storage.objects for insert with check (bucket_id='post-images' and auth.uid() is not null);
create policy "users update post images" on storage.objects for update using (bucket_id='post-images' and auth.uid() is not null);
create policy "users delete post images" on storage.objects for delete using (bucket_id='post-images' and auth.uid() is not null);
