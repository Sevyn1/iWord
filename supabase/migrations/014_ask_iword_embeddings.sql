-- Migration 014 — "Ask iWord": semantic search over transcripts (pgvector).
--
-- Each transcribed sermon is chunked into ~60-90s passages (grouped from its
-- Whisper segments) and embedded with OpenAI text-embedding-3-small. The
-- match_sermon_chunks RPC powers /api/ask: embed the user's question, find the
-- closest passages across the whole catalog, and let GPT answer with citations
-- that deep-link to the exact moment in the audio.
--
-- Run once in Supabase Dashboard → SQL Editor (after 013).

create extension if not exists vector;

-- Track per-sermon embedding state (chunks are rebuilt whenever re-run).
alter table public.sermons
  add column if not exists embed_status text not null default 'pending'
    check (embed_status in ('pending', 'done', 'failed'));

create table if not exists public.sermon_chunks (
  id          bigint generated always as identity primary key,
  sermon_id   text not null references public.sermons(id) on delete cascade,
  seq         int not null,
  start_sec   real not null,
  end_sec     real not null,
  text        text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now(),
  unique (sermon_id, seq)
);

create index if not exists sermon_chunks_sermon_id_idx
  on public.sermon_chunks(sermon_id);

-- Cosine-distance HNSW index for fast nearest-neighbour search.
create index if not exists sermon_chunks_embedding_idx
  on public.sermon_chunks using hnsw (embedding vector_cosine_ops);

-- Chunks are only read server-side (service role) through the RPC below; no
-- public policies needed.
alter table public.sermon_chunks enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- match_sermon_chunks(query_embedding, match_count, min_similarity)
--
-- Nearest passages across all published sermons, with enough sermon metadata
-- joined in to render citations without a second round-trip.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.match_sermon_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  min_similarity real default 0.15
)
returns table (
  sermon_id text,
  slug text,
  title text,
  pastor_name text,
  church text,
  start_sec real,
  end_sec real,
  chunk_text text,
  similarity real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.sermon_id,
    s.slug,
    s.title,
    coalesce(p.name, '') as pastor_name,
    coalesce(p.church, '') as church,
    c.start_sec,
    c.end_sec,
    c.text as chunk_text,
    (1 - (c.embedding <=> query_embedding))::real as similarity
  from public.sermon_chunks c
  join public.sermons s on s.id = c.sermon_id
  left join public.pastors p on p.id = s.pastor_id
  where s.is_published
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 30));
$$;

-- Only the server (service role) may call it.
revoke execute on function public.match_sermon_chunks(vector, int, real) from public, anon, authenticated;
