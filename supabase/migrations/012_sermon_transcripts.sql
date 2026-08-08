-- Migration 012 — sermon transcripts.
--
-- Adds transcript storage to sermons and folds transcript text into full-text
-- search (weight D, so title/scripture/topic still dominate ranking). The
-- transcript itself is produced by scripts/transcribe-sermons.mjs (OpenAI
-- Whisper) and is world-readable like the rest of the published sermon row.
--
--   transcript         full plain-text transcript (null = not yet transcribed)
--   transcript_status  pending | done | failed  (failed rows can be retried)
--
-- Run once in Supabase Dashboard → SQL Editor (after 011).

alter table public.sermons
  add column if not exists transcript text,
  add column if not exists transcript_status text not null default 'pending'
    check (transcript_status in ('pending', 'done', 'failed'));

-- Include transcripts in search at the lowest weight.
create or replace function public.sermons_refresh_search_vec()
returns trigger
language plpgsql
as $$
begin
  new.search_vec :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.scripture, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.topic, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(new.tags, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.summary, '')), 'C') ||
    setweight(to_tsvector('english', left(coalesce(new.transcript, ''), 400000)), 'D');
  return new;
end;
$$;

-- Re-fire the trigger when a transcript lands.
drop trigger if exists sermons_search_vec_trigger on public.sermons;
create trigger sermons_search_vec_trigger
  before insert or update of title, scripture, topic, tags, summary, transcript
  on public.sermons
  for each row execute function public.sermons_refresh_search_vec();
