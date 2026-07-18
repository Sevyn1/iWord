import { createHash } from "crypto";
import type { ChurchIdentity, NormalizedEpisode, NormalizedFeed } from "./types";

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
  return (hash[0] * 256 + hash[1]) % 360;
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

/** Normalize a name/place for identity hashing (lowercase, alnum, single spaces). */
function identityKey(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Deterministic church id from its real-world identity (name + location) rather
 * than the feed URL, so several feeds that resolve to the same church (e.g. two
 * John Piper podcasts → Bethlehem Baptist Church) merge into one church row.
 */
export function churchIdentityId(name: string, location: string): string {
  return `c-${shortHash(identityKey(name) + "|" + identityKey(location))}`;
}

/** Deterministic pastor id from the pastor's name within a church. */
export function pastorIdentityId(name: string, churchId: string): string {
  return `p-${shortHash(identityKey(name) + "|" + churchId)}`;
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
  logo_url: string | null;
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
  image_url: string | null;
  source: "podcast";
  source_ref: string;
  source_url: string | null;
  feed_url: string;
  is_published: boolean;
  content_type: "sermon" | "podcast";
};

/**
 * Build the church + pastor rows for a feed, using the resolved real-world
 * {@link ChurchIdentity} (the actual church name, senior pastor, location,
 * denomination, website and brand hue) rather than the raw podcast metadata.
 * The feed URL stays the stable source_ref for both (one feed = one church).
 */
export function feedToChurchAndPastor(
  feed: NormalizedFeed,
  identity: ChurchIdentity,
  hue: number,
  media: { logoUrl?: string | null; headshotUrl?: string | null } = {}
): { church: ChurchInsert; pastor: PastorInsert } {
  const churchName = identity.churchName || feed.title;
  const pastorName = identity.pastorName || feed.author?.trim() || churchName;

  // Identity-based ids so multiple feeds for the same church/pastor merge.
  const churchId = churchIdentityId(churchName, identity.location);
  const pastorId = pastorIdentityId(pastorName, churchId);

  // Stable, identity-derived slug suffix (same across every feed for this
  // church) so re-ingesting from any of its feeds produces the same URLs.
  const suffix = churchId.slice(2, 8);
  // Stable per-identity source_ref so the unique (source, source_ref) index
  // treats every feed of the same church as one row instead of colliding.
  const churchRef = identity.website || `church:${churchId}`;
  const pastorRef = `pastor:${pastorId}`;

  const church: ChurchInsert = {
    id: churchId,
    slug: `${slugify(churchName)}-${suffix}`,
    name: churchName,
    location: identity.location || null,
    denomination: identity.denomination || null,
    description: feed.description || null,
    website: identity.website || feed.link || null,
    initials: initialsFrom(churchName),
    hue,
    logo_url: media.logoUrl || null,
    artwork_url: feed.artworkUrl || null,
    source: "podcast",
    source_ref: churchRef,
  };

  const pastor: PastorInsert = {
    id: pastorId,
    slug: `${slugify(pastorName)}-${suffix}`,
    name: pastorName,
    title: identity.pastorTitle || "Pastor",
    church: churchName,
    church_id: churchId,
    location: identity.location || "",
    bio: feed.description || "",
    initials: initialsFrom(pastorName),
    // Pastor inherits the church's hue so their pages match.
    hue,
    followers: 0,
    // Only a real, name-matched headshot — never the podcast cover art.
    image_url: media.headshotUrl || null,
    source: "podcast",
    source_ref: pastorRef,
    feed_url: feed.feedUrl,
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
  enrichment: { summary: string; scripture: string; topic: string; tags: string[] },
  contentType: "sermon" | "podcast" = "sermon"
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
    // Prefer the episode's own artwork; fall back to the show's cover art.
    image_url: episode.artworkUrl || feed.artworkUrl || null,
    source: "podcast",
    source_ref: episode.sourceRef,
    source_url: episode.sourceUrl || null,
    feed_url: feed.feedUrl,
    is_published: true,
    content_type: contentType,
  };
}
