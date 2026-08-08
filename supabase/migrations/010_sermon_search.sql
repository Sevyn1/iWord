-- Migration 010 — full-text sermon search.
--
-- Adds a weighted tsvector column on sermons (maintained by trigger, since
-- array_to_string isn't immutable and can't back a generated column), a GIN
-- index, and a `search_sermons(q)` RPC that ranks matches by relevance and
-- also matches pastor / church names. The RPC returns ranked sermon ids so
-- the app can re-fetch full rows through its existing select + RLS.
--
-- Run once in Supabase Dashboard → SQL Editor (after 009).

-- ─────────────────────────────────────────────────────────────────────────────
-- search vector, maintained by trigger
--   A: title · B: scripture, topic, tags · C: summary
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sermons
  add column if not exists search_vec tsvector;

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
    setweight(to_tsvector('english', coalesce(new.summary, '')), 'C');
  return new;
end;
$$;

drop trigger if exists sermons_search_vec_trigger on public.sermons;
create trigger sermons_search_vec_trigger
  before insert or update of title, scripture, topic, tags, summary
  on public.sermons
  for each row execute function public.sermons_refresh_search_vec();

-- Backfill existing rows (touching title re-fires the trigger).
update public.sermons set title = title where search_vec is null;

create index if not exists sermons_search_vec_idx
  on public.sermons using gin(search_vec);

-- ─────────────────────────────────────────────────────────────────────────────
-- search_sermons(q) — ranked ids
--
-- websearch_to_tsquery supports quoted phrases and "-" exclusion. A trailing
-- ilike fallback on title / pastor / church catches partial-word queries that
-- stemming misses (e.g. "gra" → "grace"). SECURITY INVOKER + the existing RLS
-- policy keeps unpublished sermons out of anon results.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.search_sermons(q text, max_results int default 60)
returns table (id text, rank real)
language sql
stable
as $$
  with query as (
    select websearch_to_tsquery('english', q) as tsq
  )
  select s.id,
         coalesce(ts_rank(s.search_vec, query.tsq), 0)
           + case when p.name   ilike '%' || q || '%' then 0.5 else 0 end
           + case when p.church ilike '%' || q || '%' then 0.3 else 0 end
           + case when s.title  ilike '%' || q || '%' then 0.3 else 0 end
           as rank
  from public.sermons s
  left join public.pastors p on p.id = s.pastor_id
  cross join query
  where s.search_vec @@ query.tsq
     or s.title  ilike '%' || q || '%'
     or p.name   ilike '%' || q || '%'
     or p.church ilike '%' || q || '%'
  order by rank desc, s.published_at desc
  limit max_results;
$$;
