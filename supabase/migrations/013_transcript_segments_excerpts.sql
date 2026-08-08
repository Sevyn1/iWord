-- Migration 013 — transcript timestamps + AI audio excerpts.
--
-- Whisper now runs with verbose_json, so each sermon stores its transcript
-- segments ([{s,e,t}, …] seconds + text). GPT picks the most compelling ~60s
-- window, ffmpeg cuts it from the original audio during the same transcription
-- pass, and the clip lands in the public `excerpts` bucket (shareable by
-- design — recipients aren't necessarily members; generation stays gated to
-- paid plans in the UI).
--
-- Run once in Supabase Dashboard → SQL Editor (after 012).

alter table public.sermons
  add column if not exists transcript_segments jsonb,
  add column if not exists excerpt_text text,
  add column if not exists excerpt_status text not null default 'pending'
    check (excerpt_status in ('pending', 'done', 'failed'));

-- Shareable clips: public bucket (reads bypass RLS; writes stay service-role).
insert into storage.buckets (id, name, public)
values ('excerpts', 'excerpts', true)
on conflict (id) do nothing;

-- Re-queue sermons transcribed before timestamps were captured, so the
-- backfill re-runs them with verbose_json and cuts their excerpt (~$8 total).
update public.sermons
set transcript_status = 'pending'
where transcript_status = 'done' and transcript_segments is null;
