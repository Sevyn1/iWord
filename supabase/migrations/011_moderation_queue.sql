-- Migration 011 — moderation queue.
--
-- New ingested episodes now land as drafts (is_published = false) and wait in
-- the /admin/review queue. Feeds an operator trusts can be marked
-- auto_publish so their new episodes go live immediately, preserving the
-- hands-off pipeline for vetted sources. The anon RLS policy from migration
-- 007 (is_published = true) already keeps drafts hidden from the public site.
--
-- Existing content is grandfathered: everything already ingested stays
-- published, and feeds added before this migration default to auto_publish so
-- their behavior doesn't silently change.
--
-- Run once in Supabase Dashboard → SQL Editor (after 010).

alter table public.feeds
  add column if not exists auto_publish boolean not null default false;

-- Grandfather: operator-vetted feeds that are already live keep auto-publishing.
update public.feeds set auto_publish = true;
