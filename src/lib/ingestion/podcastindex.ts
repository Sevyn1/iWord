import { createHash } from "crypto";
import type { FeedCandidate } from "./types";

/**
 * Podcast Index discovery client.
 *
 * Wraps the Podcast Index API (https://podcastindex.org) so the pipeline can
 * discover new sermon/gospel podcasts by search term. Requires PODCAST_INDEX_KEY
 * and PODCAST_INDEX_SECRET; without them {@link searchPodcasts} returns an empty
 * list so ingestion still runs on the manually-added feeds.
 *
 * Auth: every request sends the API key, a unix timestamp, and an Authorization
 * header of sha1(key + secret + timestamp).
 */

const API_BASE = "https://api.podcastindex.org/api/1.0";
const USER_AGENT = "iWordBot/1.0 (+https://iword.app)";
const FETCH_TIMEOUT_MS = 15_000;

function credentials(): { key: string; secret: string } | null {
  const key = process.env.PODCAST_INDEX_KEY;
  const secret = process.env.PODCAST_INDEX_SECRET;
  if (!key || !secret) return null;
  return { key, secret };
}

/** Whether Podcast Index discovery is configured. */
export function isPodcastIndexConfigured(): boolean {
  return credentials() !== null;
}

function authHeaders(key: string, secret: string): Record<string, string> {
  const now = Math.floor(Date.now() / 1000).toString();
  const auth = createHash("sha1").update(key + secret + now).digest("hex");
  return {
    "User-Agent": USER_AGENT,
    "X-Auth-Key": key,
    "X-Auth-Date": now,
    Authorization: auth,
  };
}

type PiFeed = {
  url?: string;
  title?: string;
  author?: string;
  description?: string;
  link?: string;
  image?: string;
  artwork?: string;
};

function mapFeed(f: PiFeed): FeedCandidate | null {
  if (!f.url || !f.title) return null;
  return {
    url: f.url,
    title: f.title,
    author: f.author || undefined,
    description: f.description || undefined,
    link: f.link || undefined,
    artworkUrl: f.artwork || f.image || undefined,
  };
}

async function piFetch(path: string): Promise<unknown> {
  const creds = credentials();
  if (!creds) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: authHeaders(creds.key, creds.secret),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Podcast Index HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Search for podcasts by term (e.g. "sermon", "gospel", a church name).
 * Returns candidate feeds to add. Empty when unconfigured or on error.
 */
export async function searchPodcasts(
  term: string,
  max = 20
): Promise<FeedCandidate[]> {
  if (!isPodcastIndexConfigured()) return [];
  try {
    const query = `/search/byterm?q=${encodeURIComponent(term)}&max=${max}&fulltext`;
    const data = (await piFetch(query)) as { feeds?: PiFeed[] } | null;
    if (!data?.feeds) return [];
    return data.feeds
      .map(mapFeed)
      .filter((f): f is FeedCandidate => f !== null);
  } catch {
    return [];
  }
}
