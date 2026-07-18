-- Migration 008 — richer church/pastor media + content typing.
--
-- Adds:
--   • churches.logo_url  — the church's real logo (extracted from its website),
--     distinct from artwork_url (podcast cover art, kept as a fallback). Can be
--     overridden manually from the admin dashboard.
--   • feeds.content_type — whether a feed's episodes are full worship-service
--     'sermon's or a 'podcast'/teaching program (Q&A, radio, etc.). Set by AI at
--     ingestion and editable in admin.
--   • sermons.content_type — stamped from the feed so church pages can split
--     "Sermons" and "Podcast" into separate tabs.
--
-- pastors.image_url already exists (migration 007); this migration just starts
-- populating it with a real, name-matched headshot from the church's site.
--
-- Run once in Supabase Dashboard → SQL Editor (after 007).

alter table public.churches
  add column if not exists logo_url text;

alter table public.feeds
  add column if not exists content_type text not null default 'sermon';

alter table public.sermons
  add column if not exists content_type text not null default 'sermon';

create index if not exists sermons_content_type_idx on public.sermons(content_type);
