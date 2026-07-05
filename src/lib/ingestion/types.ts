/**
 * Internal shapes used by the ingestion pipeline. These are the "raw, cleaned"
 * representations produced by the source parsers (RSS, Podcast Index) before
 * they're enriched and mapped into the app's Church / Pastor / Sermon rows.
 */

/** A single episode extracted from a podcast feed. */
export type NormalizedEpisode = {
  /** Stable per-episode identifier for de-duplication (guid ?? enclosure url). */
  sourceRef: string;
  title: string;
  /** Plain-text description (HTML stripped). */
  description: string;
  /** ISO date string. */
  publishedAt: string;
  /** Duration in seconds (0 when unknown). */
  durationSec: number;
  /** Direct URL to the audio enclosure. */
  audioUrl: string;
  /** Canonical link back to the episode page (for attribution). */
  sourceUrl?: string;
  /** Per-episode artwork, if the feed provides it. */
  artworkUrl?: string;
};

/** A whole podcast feed: the show (ministry/church) plus its episodes. */
export type NormalizedFeed = {
  /** The feed URL that was fetched. */
  feedUrl: string;
  /** Show title — treated as the church / ministry name. */
  title: string;
  /** itunes:author — treated as the pastor / host name. */
  author?: string;
  /** Plain-text show description. */
  description: string;
  /** The show's website link. */
  link?: string;
  /** Show artwork URL (used for theming / hue derivation). */
  artworkUrl?: string;
  episodes: NormalizedEpisode[];
};

/** A discovery hit from Podcast Index (a candidate feed to add). */
export type FeedCandidate = {
  /** RSS feed URL. */
  url: string;
  title: string;
  author?: string;
  description?: string;
  /** Show website. */
  link?: string;
  artworkUrl?: string;
};

/** AI-generated (or heuristic) enrichment for a single episode. */
export type EpisodeEnrichment = {
  summary: string;
  scripture: string;
  topic: string;
  tags: string[];
};

/** Outcome of ingesting one feed, for logging + admin display. */
export type IngestResult = {
  feedUrl: string;
  ok: boolean;
  churchId?: string;
  pastorId?: string;
  /** Episodes newly inserted this run. */
  added: number;
  /** Episodes skipped because they already existed. */
  skipped: number;
  error?: string;
};
