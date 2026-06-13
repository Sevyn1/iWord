-- iWord — Supabase schema (Phase A: auth + content tables, public-read content)
-- Run this once in Supabase Dashboard → SQL Editor → New query → paste → Run.

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles : extra columns for an authenticated user
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  location    text,            -- city or ZIP
  avatar_url  text,
  plan        text not null default 'free'
              check (plan in ('free', 'devoted', 'patron')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by owner"   on public.profiles;
drop policy if exists "Profiles are updatable by owner"  on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select using (auth.uid() = id);
create policy "Profiles are updatable by owner"
  on public.profiles for update using (auth.uid() = id);

-- Auto-insert profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, location)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'location',  '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- pastors and sermons (publicly readable content)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pastors (
  id          text primary key,
  slug        text unique not null,
  name        text not null,
  title       text,
  church      text,
  location    text,
  bio         text,
  initials    text,
  hue         int  not null default 200,
  followers   int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.sermons (
  id              text primary key,
  slug            text unique not null,
  title           text not null,
  pastor_id       text references public.pastors(id) on delete set null,
  scripture       text,
  topic           text,
  tags            text[] not null default '{}',
  published_at    timestamptz not null default now(),
  duration_sec    int  not null default 0,
  audio_url       text not null,
  summary         text,
  hue             int  not null default 200,
  views_this_week int  not null default 0,
  excerpt_url     text,
  created_at      timestamptz not null default now()
);

create index if not exists sermons_pastor_id_idx     on public.sermons(pastor_id);
create index if not exists sermons_published_at_idx  on public.sermons(published_at desc);
create index if not exists sermons_views_week_idx    on public.sermons(views_this_week desc);

alter table public.pastors  enable row level security;
alter table public.sermons  enable row level security;

drop policy if exists "Pastors are publicly readable" on public.pastors;
drop policy if exists "Sermons are publicly readable" on public.sermons;
create policy "Pastors are publicly readable" on public.pastors  for select using (true);
create policy "Sermons are publicly readable" on public.sermons  for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- follows : (user, pastor) pairs
-- Note: pastor_id is a plain text id (content currently lives in the app, not
-- the DB) so there is intentionally no FK to public.pastors here.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  user_id     uuid references auth.users(id) on delete cascade,
  pastor_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, pastor_id)
);

alter table public.follows enable row level security;

drop policy if exists "Users see their own follows"   on public.follows;
drop policy if exists "Users add their own follows"   on public.follows;
drop policy if exists "Users remove their own follows" on public.follows;
create policy "Users see their own follows"
  on public.follows for select using (auth.uid() = user_id);
create policy "Users add their own follows"
  on public.follows for insert with check (auth.uid() = user_id);
create policy "Users remove their own follows"
  on public.follows for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- listens : a row each time a user plays a sermon (for history + trending)
-- Note: sermon_id is a plain text id (no FK to public.sermons) for the same
-- reason as follows.pastor_id above.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.listens (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  sermon_id     text not null,
  listened_at   timestamptz not null default now(),
  duration_sec  int not null default 0
);

create index if not exists listens_user_id_idx   on public.listens(user_id);
create index if not exists listens_sermon_id_idx on public.listens(sermon_id);

alter table public.listens enable row level security;

drop policy if exists "Users see their own listens" on public.listens;
drop policy if exists "Users add their own listens" on public.listens;
create policy "Users see their own listens"
  on public.listens for select using (auth.uid() = user_id);
create policy "Users add their own listens"
  on public.listens for insert with check (auth.uid() = user_id);
