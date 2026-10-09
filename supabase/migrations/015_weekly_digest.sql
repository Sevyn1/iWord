-- Migration 015 — Weekly digest: newsletter subscribers + unsubscribe tokens.
--
-- Members (profiles) receive the digest automatically; this table stores
-- (a) anonymous signups from the homepage strip and (b) one row per emailed
-- member so a single token-based unsubscribe mechanism covers everyone.
-- Rows are only touched server-side (service role) — no public policies.
--
-- Run once in Supabase Dashboard → SQL Editor (after 014).

create table if not exists public.newsletter_subscribers (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique,
  token            uuid not null unique default gen_random_uuid(),
  -- Set when the email belongs to a member; anonymous signups leave it null.
  user_id          uuid references auth.users(id) on delete cascade,
  source           text not null default 'homepage',
  created_at       timestamptz not null default now(),
  unsubscribed_at  timestamptz
);

create index if not exists newsletter_subscribers_active_idx
  on public.newsletter_subscribers(email)
  where unsubscribed_at is null;

alter table public.newsletter_subscribers enable row level security;
