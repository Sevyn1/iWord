-- Migration 005 — anonymous stream throttling.
--
-- Backs the stream endpoint's IP-based protections:
--   * a monthly cap for signed-out (anonymous) listeners, and
--   * a short-window rate limit that blocks bulk harvesting of signed URLs.
--
-- We store a SHA-256 hash of the client IP (never the raw address). Only the
-- service-role client touches this table, so RLS is enabled with no policies
-- (the service role bypasses RLS; anon/auth clients get no access).
--
-- Rows are disposable — safe to prune anything older than ~35 days on a
-- schedule (e.g. a cron), since only the current minute and month matter.
--
-- Run once in Supabase Dashboard → SQL Editor.

create table if not exists public.stream_hits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  sermon_id text not null,
  created_at timestamptz not null default now()
);

-- Serves both lookups: recent-window count (rate limit) and this-month
-- distinct sermons (anonymous cap), both scoped to an ip_hash.
create index if not exists stream_hits_ip_created_idx
  on public.stream_hits (ip_hash, created_at desc);

alter table public.stream_hits enable row level security;
