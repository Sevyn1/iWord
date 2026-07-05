import type { FeedCandidate } from "./types";

/**
 * Apple / iTunes Search discovery.
 *
 * Uses Apple's public iTunes Search API to find podcasts by term and return
 * their RSS feed URLs. It requires no API key or signup, so it's the default
 * discovery backend. Results without a usable feed URL are dropped.
 *
 * Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI
 */

const SEARCH_URL = "https://itunes.apple.com/search";
const USER_AGENT = "iWordBot/1.0 (+https://iword.app)";
const FETCH_TIMEOUT_MS = 15_000;

type ItunesResult = {
  feedUrl?: string;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
};

function mapResult(r: ItunesResult): FeedCandidate | null {
  if (!r.feedUrl) return null;
  const title = r.collectionName || r.trackName;
  if (!title) return null;
  return {
    url: r.feedUrl,
    title,
    author: r.artistName || undefined,
    link: r.collectionViewUrl || undefined,
    artworkUrl: r.artworkUrl600 || r.artworkUrl100 || undefined,
  };
}

/**
 * Search Apple Podcasts for a term. Returns candidate feeds to add. Empty on
 * error. `country` scopes the catalog (default US, the largest).
 */
export async function searchApplePodcasts(
  term: string,
  max = 20,
  country = "US"
): Promise<FeedCandidate[]> {
  const query = term.trim();
  if (!query) return [];

  const params = new URLSearchParams({
    media: "podcast",
    entity: "podcast",
    term: query,
    limit: String(Math.min(Math.max(max, 1), 200)),
    country,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`iTunes Search HTTP ${res.status}`);
    const data = (await res.json()) as { results?: ItunesResult[] };
    if (!data.results) return [];
    // De-dupe by feed URL (Apple can return the show multiple times).
    const seen = new Set<string>();
    const out: FeedCandidate[] = [];
    for (const r of data.results) {
      const mapped = mapResult(r);
      if (mapped && !seen.has(mapped.url)) {
        seen.add(mapped.url);
        out.push(mapped);
      }
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
