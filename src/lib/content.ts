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
  source: string | null;
  source_url: string | null;
  content_type: string | null;
  pastor?: JoinedPastor;
  church?: JoinedChurch;
};

const SERMON_SELECT =
  "id, slug, title, pastor_id, scripture, topic, tags, published_at, duration_sec, audio_url, summary, hue, views_this_week, excerpt_url, source, source_url, content_type, pastor:pastors(slug, name, church, initials, hue, image_url), church:churches(artwork_url, logo_url)";

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
    imageUrl: r.church?.artwork_url ?? r.church?.logo_url ?? undefined,
    excerptUrl: r.excerpt_url ?? undefined,
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
