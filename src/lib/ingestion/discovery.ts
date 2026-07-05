import type { FeedCandidate } from "./types";
import { isPodcastIndexConfigured, searchPodcasts } from "./podcastindex";
import { searchApplePodcasts } from "./itunes";

/**
 * Feed discovery.
 *
 * Finds candidate podcast feeds by search term. Uses Podcast Index when it's
 * configured (richer metadata), and otherwise falls back to Apple's free
 * iTunes Search API — which needs no key or signup — so discovery always works.
 */

/** Human-readable name of the active discovery backend. */
export function discoveryProvider(): "Podcast Index" | "Apple Podcasts" {
  return isPodcastIndexConfigured() ? "Podcast Index" : "Apple Podcasts";
}

/** Discovery is always available (Apple search requires no credentials). */
export function isDiscoveryConfigured(): boolean {
  return true;
}

/** Search for candidate feeds by term. */
export async function discover(term: string, max = 20): Promise<FeedCandidate[]> {
  if (isPodcastIndexConfigured()) {
    const results = await searchPodcasts(term, max);
    if (results.length > 0) return results;
  }
  return searchApplePodcasts(term, max);
}
