-- Migration 001 — decouple follows/listens from content tables.
--
-- The original schema added foreign keys:
--   follows.pastor_id  -> public.pastors(id)
--   listens.sermon_id  -> public.sermons(id)
-- But sermon/pastor content currently lives in the app, not the database,
-- so those tables are empty and the FKs would block every insert.
--
-- Run this ONCE in Supabase → SQL Editor if you already ran schema.sql before
-- this change. Safe to run multiple times.

alter table public.follows
  drop constraint if exists follows_pastor_id_fkey;

alter table public.follows
  alter column pastor_id set not null;

alter table public.listens
  drop constraint if exists listens_sermon_id_fkey;

alter table public.listens
  alter column sermon_id set not null;
