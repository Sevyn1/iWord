-- Migration 007 — content ingestion foundation.
--
-- Moves churches/pastors/sermons content into the database so the automated
-- ingestion pipeline (RSS/podcast feeds + Podcast Index discovery) can add new
-- content on a schedule, and the site reads from the DB instead of hardcoded
-- arrays. Also adds provenance columns (source, source_ref, feed_url) used to
-- de-duplicate re-ingested episodes, and a `feeds` table of sources to scan.
--
-- Run once in Supabase Dashboard → SQL Editor (after 006).

-- ─────────────────────────────────────────────────────────────────────────────
-- shared: keep updated_at fresh on write
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- churches (publicly readable content)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.churches (
  id           text primary key,
  slug         text unique not null,
  name         text not null,
  location     text,
  denomination text,
  description  text,
  website      text,
  initials     text,
  -- Hue is derived from the church's real branding during ingestion so pages
  -- "match" the church's identity.
  hue          int  not null default 200,
  founded      int,
  artwork_url  text,
  source       text not null default 'manual',
  -- Stable external identifier for de-duplication (e.g. feed url / channel id).
  source_ref   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists churches_source_ref_idx
  on public.churches(source, source_ref) where source_ref is not null;

alter table public.churches enable row level security;
drop policy if exists "Churches are publicly readable" on public.churches;
create policy "Churches are publicly readable" on public.churches for select using (true);

drop trigger if exists churches_touch_updated_at on public.churches;
create trigger churches_touch_updated_at
  before update on public.churches
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- pastors: ingestion + theming columns
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.pastors
  add column if not exists church_id   text references public.churches(id) on delete set null,
  add column if not exists image_url   text,
  add column if not exists source      text not null default 'manual',
  add column if not exists source_ref  text,
  add column if not exists feed_url    text,
  add column if not exists ingested_at timestamptz,
  add column if not exists updated_at  timestamptz not null default now();

create unique index if not exists pastors_source_ref_idx
  on public.pastors(source, source_ref) where source_ref is not null;
create index if not exists pastors_church_id_idx on public.pastors(church_id);

drop trigger if exists pastors_touch_updated_at on public.pastors;
create trigger pastors_touch_updated_at
  before update on public.pastors
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- sermons: ingestion + provenance columns
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sermons
  add column if not exists church_id    text references public.churches(id) on delete set null,
  add column if not exists source       text not null default 'manual',
  add column if not exists source_ref   text,
  add column if not exists feed_url     text,
  add column if not exists source_url   text,
  add column if not exists is_published boolean not null default true,
  add column if not exists ingested_at  timestamptz,
  add column if not exists updated_at   timestamptz not null default now();

create unique index if not exists sermons_source_ref_idx
  on public.sermons(source, source_ref) where source_ref is not null;
create index if not exists sermons_church_id_idx   on public.sermons(church_id);
create index if not exists sermons_is_published_idx on public.sermons(is_published);

drop trigger if exists sermons_touch_updated_at on public.sermons;
create trigger sermons_touch_updated_at
  before update on public.sermons
  for each row execute function public.touch_updated_at();

-- Only published sermons are publicly readable (drafts stay hidden until an
-- operator approves them from the admin dashboard).
drop policy if exists "Sermons are publicly readable" on public.sermons;
create policy "Sermons are publicly readable"
  on public.sermons for select using (is_published = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- feeds: the list of sources the ingestion job scans
--   kind: 'podcast' (RSS), 'podcastindex' (discovery query), 'youtube'
-- Managed only by the service role (admin dashboard); not publicly readable.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.feeds (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null default 'podcast',
  url             text not null,
  title           text,
  church_id       text references public.churches(id) on delete set null,
  pastor_id       text references public.pastors(id)  on delete set null,
  active          boolean not null default true,
  last_scanned_at timestamptz,
  last_status     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists feeds_kind_url_idx on public.feeds(kind, url);

alter table public.feeds enable row level security;
-- No public policies: only the service-role key (admin dashboard / cron) may
-- read or write feeds; RLS blocks the anon key entirely.

drop trigger if exists feeds_touch_updated_at on public.feeds;
create trigger feeds_touch_updated_at
  before update on public.feeds
  for each row execute function public.touch_updated_at();
