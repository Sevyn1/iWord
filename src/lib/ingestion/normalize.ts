import { createHash } from "crypto";
import type { NormalizedEpisode, NormalizedFeed } from "./types";

/**
 * Mapping helpers that turn parsed feed data into the DB row shapes used by the
 * catalog, plus small deterministic utilities (slugs, initials, fallback hue)
 * so re-ingesting the same feed always produces the same stable ids.
 */

/** URL/DB-safe slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
}

/** Two-letter initials for avatar/logo placeholders. */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Deterministic pleasant hue (0-359) from a string. Used as the fallback when
 * AI/artwork-derived theming isn't available, so a church still gets a stable,
 * on-brand-ish colour instead of a random one on every run.
 */
export function hueFromString(input: string): number {
  const hash = createHash("sha1").update(input).digest();
  return hash[0] % 360;
}

/** Short stable hash suffix to keep generated ids/slugs unique. */
function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 8);
}

/** Deterministic church id from its feed identity. */
export function churchIdFor(sourceRef: string): string {
  return `c-${shortHash(sourceRef)}`;
}

/** Deterministic pastor id from its feed identity. */
export function pastorIdFor(sourceRef: string): string {
  return `p-${shortHash(sourceRef)}`;
}

/** Deterministic sermon id from its per-episode source ref. */
export function sermonIdFor(sourceRef: string): string {
  return `s-${shortHash(sourceRef)}`;
}

/** Stable, collision-resistant slug for a sermon (title + ref hash). */
export function sermonSlug(title: string, sourceRef: string): string {
  return `${slugify(title)}-${shortHash(sourceRef).slice(0, 6)}`;
}

/**
 * Rough word count → nothing; kept minimal. Excerpt for a summary fallback when
 * AI enrichment is unavailable: first ~2 sentences, capped in length.
 */
export function excerptSummary(description: string, max = 280): string {
  const clean = description.trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > 80 ? cut.slice(0, lastStop + 1) : cut.trimEnd()) + "…";
}

// ── row shapes written to Supabase (snake_case) ──────────────────────────────

export type ChurchInsert = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  denomination: string | null;
  description: string | null;
  website: string | null;
  initials: string;
  hue: number;
  artwork_url: string | null;
  source: "podcast";
  source_ref: string;
};

export type PastorInsert = {
  id: string;
  slug: string;
  name: string;
  title: string;
  church: string;
  church_id: string;
  location: string;
  bio: string;
  initials: string;
  hue: number;
  followers: number;
  image_url: string | null;
  source: "podcast";
  source_ref: string;
  feed_url: string;
};

export type SermonInsert = {
  id: string;
  slug: string;
  title: string;
  pastor_id: string;
  church_id: string;
  scripture: string;
  topic: string;
  tags: string[];
  published_at: string;
  duration_sec: number;
  audio_url: string;
  summary: string;
  hue: number;
  views_this_week: number;
  source: "podcast";
  source_ref: string;
  source_url: string | null;
  feed_url: string;
  is_published: boolean;
};

/**
 * Build the church + pastor rows for a feed. The feed URL is the stable
 * source_ref for both (one feed = one show = one church + host pastor here).
 */
export function feedToChurchAndPastor(
  feed: NormalizedFeed,
  hue: number
): { church: ChurchInsert; pastor: PastorInsert } {
  const feedRef = feed.feedUrl;
  const churchName = feed.title;
  const pastorName = feed.author?.trim() || feed.title;

  const churchId = churchIdFor(feedRef);
  const pastorId = pastorIdFor(feedRef);

  // Suffix pretty slugs with a short hash so two feeds with the same show name
  // can't collide on the unique slug constraint (and URLs stay stable per feed).
  const suffix = shortHash(feedRef).slice(0, 6);

  const church: ChurchInsert = {
    id: churchId,
    slug: `${slugify(churchName)}-${suffix}`,
    name: churchName,
    location: null,
    denomination: null,
    description: feed.description || null,
    website: feed.link || null,
    initials: initialsFrom(churchName),
    hue,
    artwork_url: feed.artworkUrl || null,
    source: "podcast",
    source_ref: feedRef,
  };

  const pastor: PastorInsert = {
    id: pastorId,
    slug: `${slugify(pastorName)}-${suffix}`,
    name: pastorName,
    title: "Host",
    church: churchName,
    church_id: churchId,
    location: "",
    bio: feed.description || "",
    initials: initialsFrom(pastorName),
    // Pastor inherits the church's hue so their pages match.
    hue,
    followers: 0,
    image_url: feed.artworkUrl || null,
    source: "podcast",
    source_ref: feedRef,
    feed_url: feedRef,
  };

  return { church, pastor };
}

/** Build a sermon row from an episode + its enrichment. */
export function episodeToSermon(
  feed: NormalizedFeed,
  episode: NormalizedEpisode,
  churchId: string,
  pastorId: string,
  hue: number,
  enrichment: { summary: string; scripture: string; topic: string; tags: string[] }
): SermonInsert {
  return {
    id: sermonIdFor(episode.sourceRef),
    slug: sermonSlug(episode.title, episode.sourceRef),
    title: episode.title,
    pastor_id: pastorId,
    church_id: churchId,
    scripture: enrichment.scripture,
    topic: enrichment.topic,
    tags: enrichment.tags,
    published_at: episode.publishedAt,
    duration_sec: episode.durationSec,
    audio_url: episode.audioUrl,
    summary: enrichment.summary,
    hue,
    views_this_week: 0,
    source: "podcast",
    source_ref: episode.sourceRef,
    source_url: episode.sourceUrl || null,
    feed_url: feed.feedUrl,
    is_published: true,
  };
}
