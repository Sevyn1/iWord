-- Migration 009 — per-sermon cover art.
--
-- Adds sermons.image_url so each episode can carry its own artwork (parsed
-- from the feed's per-item <itunes:image>). The church's podcast cover art
-- (churches.artwork_url) remains the fallback when an episode has none.
--
-- Run once in Supabase Dashboard → SQL Editor (after 008).

alter table public.sermons
  add column if not exists image_url text;
