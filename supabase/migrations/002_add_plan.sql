-- Migration 002 — add a subscription plan to profiles so we can tell paid
-- members apart from free accounts (and from the free weekly newsletter).
--
-- plan values:
--   'free'    — signed up, newsletter only (default)
--   'devoted' — paid: unlimited streaming
--   'patron'  — paid: supports pastors directly
--
-- Run once in Supabase Dashboard → SQL Editor.

alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'devoted', 'patron'));
