-- Migration 004 — Stripe billing fields on profiles.
--
-- Links a profile to its Stripe customer + active subscription so the webhook
-- can sync `plan` when subscriptions are created, updated, or canceled.
--
-- Run once in Supabase Dashboard → SQL Editor.

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_status text;

-- Fast lookups from the webhook (which only knows the Stripe customer id).
create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id);
