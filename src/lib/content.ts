import type { Church, ContentSource, Pastor, PastorSummary, Sermon } from "./types";
import { createPublicClient } from "./supabase/public";
import { SEED_SERMONS } from "./sermons";
import { SEED_PASTORS } from "./pastors";
import { SEED_CHURCHES } from "./churches";

/**
 * Content data-access layer.
 *
 * These getters read churches / pastors / published sermons from Supabase so
 * the automated ingestion pipeline can grow the catalog on a schedule. When
 * Supabase isn't configured, or a query fails, or the DB has no content yet,
 * they transparently fall back to the bundled seed arrays so the site always
 * renders. Row Level Security keeps unpublished drafts hidden from the anon
 * client.
 */

// ── row shapes (snake_case, as stored) ──────────────────────────────────────

type PastorRow = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  church: string | null;
  church_id: string | null;
  location: string | null;
  bio: string | null;
  initials: string | null;
  hue: number;
  followers: number;
  image_url: string | null;
  source: string | null;
};

type ChurchRow = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  denomination: string | null;
  description: string | null;
  website: string | null;
  initials: string | null;
  hue: number;
  founded: number | null;
  logo_url: string | null;
  artwork_url: string | null;
  source: string | null;
};

type JoinedPastor = {
  slug: string;
  name: string;
  church: string | null;
  initials: string | null;
  hue: number;
  image_url: string | null;
} | null;

type JoinedChurch = {
  artwork_url: string | null;
  logo_url: string | null;
} | null;

type SermonRow = {
  id: string;
  slug: string;
  title: string;
  pastor_id: string | null;
  scripture: string | null;
  topic: string | null;
  tags: string[] | null;
  published_at: string;
  duration_sec: number;
  audio_url: string;
  summary: string | null;
  hue: number;
  views_this_week: number;
  excerpt_url: string | null;
  excerpt_text: string | null;
  source: string | null;
  source_url: string | null;
  content_type: string | null;
  image_url: string | null;
  pastor?: JoinedPastor;
  church?: JoinedChurch;
};

const SERMON_SELECT =
  "id, slug, title, pastor_id, scripture, topic, tags, published_at, duration_sec, audio_url, summary, hue, views_this_week, excerpt_url, excerpt_text, source, source_url, content_type, image_url, pastor:pastors(slug, name, church, initials, hue, image_url), church:churches(artwork_url, logo_url)";

// ── mappers ─────────────────────────────────────────────────────────────────

function mapPastor(r: PastorRow): Pastor {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    title: r.title ?? "",
    church: r.church ?? "",
    churchId: r.church_id ?? "",
    location: r.location ?? "",
    bio: r.bio ?? "",
    initials: r.initials ?? "",
    hue: r.hue,
    followers: r.followers,
    imageUrl: r.image_url ?? undefined,
    source: (r.source as ContentSource) ?? "manual",
  };
}

function mapChurch(r: ChurchRow): Church {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    location: r.location ?? "",
    denomination: r.denomination ?? undefined,
    description: r.description ?? "",
    website: r.website ?? undefined,
    initials: r.initials ?? "",
    hue: r.hue,
    founded: r.founded ?? undefined,
    logoUrl: r.logo_url ?? undefined,
    artworkUrl: r.artwork_url ?? undefined,
    source: (r.source as ContentSource) ?? "manual",
  };
}

function summaryFromJoin(p: JoinedPastor): PastorSummary | undefined {
  if (!p) return undefined;
  return {
    slug: p.slug,
    name: p.name,
    church: p.church ?? "",
    initials: p.initials ?? "",
    hue: p.hue,
    imageUrl: p.image_url ?? undefined,
  };
}

function mapSermon(r: SermonRow): Sermon {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    pastorId: r.pastor_id ?? "",
    scripture: r.scripture ?? "",
    topic: r.topic ?? "",
    tags: r.tags ?? [],
    publishedAt: r.published_at,
    durationSec: r.duration_sec,
    audioUrl: r.audio_url,
    summary: r.summary ?? "",
    hue: r.hue,
    viewsThisWeek: r.views_this_week,
    imageUrl:
      r.image_url ?? r.church?.artwork_url ?? r.church?.logo_url ?? undefined,
    excerptUrl: r.excerpt_url ?? undefined,
    excerptText: r.excerpt_text ?? undefined,
    source: (r.source as ContentSource) ?? "manual",
    contentType: r.content_type === "podcast" ? "podcast" : "sermon",
    sourceUrl: r.source_url ?? undefined,
    pastor: summaryFromJoin(r.pastor ?? null),
  };
}

// ── seed helpers (offline fallback) ─────────────────────────────────────────

function seedSummary(pastorId: string): PastorSummary | undefined {
  const p = SEED_PASTORS.find((x) => x.id === pastorId);
  if (!p) return undefined;
  return {
    slug: p.slug,
    name: p.name,
    church: p.church,
    initials: p.initials,
    hue: p.hue,
  };
}

/** Seed sermons with their denormalized pastor summary attached. */
const SEED_SERMONS_WITH_PASTOR: Sermon[] = SEED_SERMONS.map((s) => ({
  ...s,
  pastor: s.pastor ?? seedSummary(s.pastorId),
}));

// ── sermons ──────────────────────────────────────────────────────────────────

export async function getAllSermons(): Promise<Sermon[]> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("sermons")
      .select(SERMON_SELECT)
      .order("published_at", { ascending: false });
    if (!error && data && data.length > 0) {
      return (data as unknown as SermonRow[]).map(mapSermon);
    }
  }
  return SEED_SERMONS_WITH_PASTOR;
}

export async function getSermonBySlug(slug: string): Promise<Sermon | undefined> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("sermons")
      .select(SERMON_SELECT)
      .eq("slug", slug)
      .maybeSingle();
    if (!error && data) return mapSermon(data as unknown as SermonRow);
    if (!error) return SEED_SERMONS_WITH_PASTOR.find((s) => s.slug === slug);
  }
  return SEED_SERMONS_WITH_PASTOR.find((s) => s.slug === slug);
}

export async function getSermonById(id: string): Promise<Sermon | undefined> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("sermons")
      .select(SERMON_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (!error && data) return mapSermon(data as unknown as SermonRow);
    if (!error) return SEED_SERMONS_WITH_PASTOR.find((s) => s.id === id);
  }
  return SEED_SERMONS_WITH_PASTOR.find((s) => s.id === id);
}

export async function getSermonsByPastor(pastorId: string): Promise<Sermon[]> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("sermons")
      .select(SERMON_SELECT)
      .eq("pastor_id", pastorId)
      .order("published_at", { ascending: false });
    if (!error && data) return (data as unknown as SermonRow[]).map(mapSermon);
  }
  return SEED_SERMONS_WITH_PASTOR.filter((s) => s.pastorId === pastorId);
}

/**
 * Fetch a sermon's transcript on its own so SERMON_SELECT list queries never
 * carry multi-thousand-word text columns. Null until Whisper has run
 * (transcript_status = done — see migration 012).
 */
export async function getSermonTranscript(id: string): Promise<string | null> {
  const db = createPublicClient();
  if (!db) return null;
  const { data, error } = await db
    .from("sermons")
    .select("transcript")
    .eq("id", id)
    .eq("transcript_status", "done")
    .maybeSingle();
  if (error || !data?.transcript) return null;
  return data.transcript as string;
}

// ── search ───────────────────────────────────────────────────────────────────

/** Case-insensitive in-memory match, used when the search RPC is unavailable. */
function matchesQuery(s: Sermon, q: string): boolean {
  const needle = q.toLowerCase();
  return [s.title, s.scripture, s.topic, s.summary, s.pastor?.name ?? "", ...s.tags]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/**
 * Relevance-ranked sermon search via the `search_sermons` RPC (migration 010:
 * weighted tsvector + pastor/church ilike fallback). The RPC returns ranked
 * ids; full rows are re-fetched through the normal select so RLS still
 * applies. Falls back to a simple in-memory filter when the DB is unavailable.
 */
export async function searchSermons(q: string, limit = 60): Promise<Sermon[]> {
  const query = q.trim();
  if (!query) return [];

  const db = createPublicClient();
  if (db) {
    const { data: ranked, error } = await db.rpc("search_sermons", {
      q: query,
      max_results: limit,
    });
    if (!error && ranked) {
      const ids = (ranked as { id: string; rank: number }[]).map((r) => r.id);
      if (ids.length === 0) return [];
      const { data, error: rowsErr } = await db
        .from("sermons")
        .select(SERMON_SELECT)
        .in("id", ids);
      if (!rowsErr && data) {
        const bySermonId = new Map(
          (data as unknown as SermonRow[]).map((r) => [r.id, mapSermon(r)])
        );
        return ids
          .map((id) => bySermonId.get(id))
          .filter((s): s is Sermon => Boolean(s));
      }
    }
  }

  const all = await getAllSermons();
  return all.filter((s) => matchesQuery(s, query)).slice(0, limit);
}

export type SearchSuggestions = {
  sermons: { slug: string; title: string; pastorName: string | null }[];
  pastors: { slug: string; name: string; church: string | null }[];
};

/**
 * Navbar typeahead: top-ranked sermons (same ranking as the results page)
 * plus pastors whose name or church matches. Kept small — it runs per
 * keystroke (debounced client-side, CDN-cached server-side).
 */
export async function getSearchSuggestions(q: string): Promise<SearchSuggestions> {
  const query = q.trim();
  if (query.length < 2) return { sermons: [], pastors: [] };

  const [sermons, pastors] = await Promise.all([
    searchSermons(query, 5),
    (async () => {
      const db = createPublicClient();
      // Strip PostgREST filter syntax (commas, parens) from user input.
      const safe = query.replace(/[(),]/g, " ").trim();
      if (db && safe) {
        const { data, error } = await db
          .from("pastors")
          .select("slug, name, church")
          .or(`name.ilike.%${safe}%,church.ilike.%${safe}%`)
          .order("followers", { ascending: false })
          .limit(3);
        if (!error && data) return data as { slug: string; name: string; church: string | null }[];
      }
      return SEED_PASTORS.filter((p) =>
        `${p.name} ${p.church}`.toLowerCase().includes(query.toLowerCase())
      )
        .slice(0, 3)
        .map((p) => ({ slug: p.slug, name: p.name, church: p.church }));
    })(),
  ]);

  return {
    sermons: sermons.map((s) => ({
      slug: s.slug,
      title: s.title,
      pastorName: s.pastor?.name ?? null,
    })),
    pastors,
  };
}

export async function getTrending(limit = 6): Promise<Sermon[]> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("sermons")
      .select(SERMON_SELECT)
      .order("views_this_week", { ascending: false })
      .limit(limit);
    if (!error && data && data.length > 0) {
      return (data as unknown as SermonRow[]).map(mapSermon);
    }
  }
  return [...SEED_SERMONS_WITH_PASTOR]
    .sort((a, b) => b.viewsThisWeek - a.viewsThisWeek)
    .slice(0, limit);
}

/**
 * Sermons that have an AI excerpt (audio + quote) — the "Daily Bread" clips
 * feed. Shuffled per request so the feed feels fresh on every visit.
 */
export async function getClips(limit = 60): Promise<Sermon[]> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("sermons")
      .select(SERMON_SELECT)
      .eq("is_published", true)
      .not("excerpt_url", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit * 2);
    if (!error && data && data.length > 0) {
      const mapped = (data as unknown as SermonRow[]).map(mapSermon);
      return shuffle(mapped).slice(0, limit);
    }
  }
  return shuffle(SEED_SERMONS_WITH_PASTOR.filter((s) => s.excerptUrl)).slice(0, limit);
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function getRecent(limit = 6): Promise<Sermon[]> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("sermons")
      .select(SERMON_SELECT)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (!error && data && data.length > 0) {
      return (data as unknown as SermonRow[]).map(mapSermon);
    }
  }
  return [...SEED_SERMONS_WITH_PASTOR]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, limit);
}

/** Content-similarity ranking: same pastor, topic, then shared tags. */
export async function getRelated(sermon: Sermon, limit = 4): Promise<Sermon[]> {
  const all = await getAllSermons();
  return all
    .filter((s) => s.id !== sermon.id)
    .map((s) => {
      let score = 0;
      if (s.pastorId === sermon.pastorId) score += 3;
      if (s.topic === sermon.topic) score += 2;
      score += s.tags.filter((t) => sermon.tags.includes(t)).length;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

// ── pastors ───────────────────────────────────────────────────────────────────

export async function getAllPastors(): Promise<Pastor[]> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("pastors")
      .select("*")
      .order("followers", { ascending: false });
    if (!error && data && data.length > 0) {
      return (data as unknown as PastorRow[]).map(mapPastor);
    }
  }
  return SEED_PASTORS;
}

export async function getPastorById(id: string): Promise<Pastor | undefined> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("pastors")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) return mapPastor(data as unknown as PastorRow);
    if (!error) return SEED_PASTORS.find((p) => p.id === id);
  }
  return SEED_PASTORS.find((p) => p.id === id);
}

export async function getPastorBySlug(slug: string): Promise<Pastor | undefined> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("pastors")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (!error && data) return mapPastor(data as unknown as PastorRow);
    if (!error) return SEED_PASTORS.find((p) => p.slug === slug);
  }
  return SEED_PASTORS.find((p) => p.slug === slug);
}

// ── churches ──────────────────────────────────────────────────────────────────

export async function getAllChurches(): Promise<Church[]> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("churches")
      .select("*")
      .order("name", { ascending: true });
    if (!error && data && data.length > 0) {
      return (data as unknown as ChurchRow[]).map(mapChurch);
    }
  }
  return SEED_CHURCHES;
}

export async function getChurchById(id: string): Promise<Church | undefined> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("churches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) return mapChurch(data as unknown as ChurchRow);
    if (!error) return SEED_CHURCHES.find((c) => c.id === id);
  }
  return SEED_CHURCHES.find((c) => c.id === id);
}

export async function getChurchBySlug(slug: string): Promise<Church | undefined> {
  const db = createPublicClient();
  if (db) {
    const { data, error } = await db
      .from("churches")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (!error && data) return mapChurch(data as unknown as ChurchRow);
    if (!error) return SEED_CHURCHES.find((c) => c.slug === slug);
  }
  return SEED_CHURCHES.find((c) => c.slug === slug);
}

/** Pastors belonging to a given church, most-followed first. */
export async function getPastorsByChurch(churchId: string): Promise<Pastor[]> {
  const all = await getAllPastors();
  return all
    .filter((p) => p.churchId === churchId)
    .sort((a, b) => b.followers - a.followers);
}

/** The church a pastor belongs to, if any. */
export async function getChurchForPastor(pastor: Pastor): Promise<Church | undefined> {
  if (!pastor.churchId) return undefined;
  return getChurchById(pastor.churchId);
}
