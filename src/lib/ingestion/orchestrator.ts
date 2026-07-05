import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAndParseFeed } from "./rss";
import { deriveHue, enrichEpisode } from "./enrich";
import { discover } from "./discovery";
import {
  episodeToSermon,
  feedToChurchAndPastor,
  type SermonInsert,
} from "./normalize";
import type { IngestResult, NormalizedEpisode } from "./types";

/**
 * Ingestion orchestrator.
 *
 * Pulls the active feeds from the `feeds` table, parses each one, derives its
 * theme, enriches new episodes with AI, and upserts churches / pastors /
 * sermons into the catalog via the service-role client. Existing episodes are
 * skipped (de-duped by source + source_ref), so runs are idempotent and cheap.
 *
 * Everything here runs server-side only (cron route / admin action). It must
 * never be imported into a client component.
 */

type FeedRow = {
  id: string;
  kind: string;
  url: string;
  active: boolean;
};

/** How many new episodes to enrich+insert per feed per run (cost guard). */
const MAX_NEW_PER_FEED = 20;

/** Ingest a single feed. Assumes `admin` is a valid service-role client. */
export async function ingestFeed(
  admin: SupabaseClient,
  feedUrl: string
): Promise<IngestResult> {
  try {
    const feed = await fetchAndParseFeed(feedUrl);
    if (feed.episodes.length === 0) {
      return { feedUrl, ok: true, added: 0, skipped: 0 };
    }

    const hue = await deriveHue(feed);
    const { church, pastor } = feedToChurchAndPastor(feed, hue);

    // Upsert the church + host pastor (idempotent on the deterministic id).
    const churchUpsert = await admin
      .from("churches")
      .upsert(church, { onConflict: "id" });
    if (churchUpsert.error) throw new Error(`church upsert: ${churchUpsert.error.message}`);

    const pastorUpsert = await admin
      .from("pastors")
      .upsert(pastor, { onConflict: "id" });
    if (pastorUpsert.error) throw new Error(`pastor upsert: ${pastorUpsert.error.message}`);

    // Find which episodes we already have, so we only enrich brand-new ones.
    const refs = feed.episodes.map((e) => e.sourceRef);
    const existing = await admin
      .from("sermons")
      .select("source_ref")
      .eq("source", "podcast")
      .in("source_ref", refs);
    if (existing.error) throw new Error(`dedupe query: ${existing.error.message}`);

    const seen = new Set(
      (existing.data ?? []).map((r) => (r as { source_ref: string }).source_ref)
    );
    const fresh: NormalizedEpisode[] = feed.episodes
      .filter((e) => !seen.has(e.sourceRef))
      .slice(0, MAX_NEW_PER_FEED);

    if (fresh.length === 0) {
      return {
        feedUrl,
        ok: true,
        churchId: church.id,
        pastorId: pastor.id,
        added: 0,
        skipped: feed.episodes.length,
      };
    }

    // Enrich + build rows. Enrichment is per-episode; run sequentially to stay
    // gentle on the AI rate limit.
    const rows: SermonInsert[] = [];
    for (const episode of fresh) {
      const enrichment = await enrichEpisode(feed.title, episode.title, episode.description);
      rows.push(
        episodeToSermon(feed, episode, church.id, pastor.id, hue, enrichment)
      );
    }

    const insert = await admin
      .from("sermons")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (insert.error) throw new Error(`sermon insert: ${insert.error.message}`);

    return {
      feedUrl,
      ok: true,
      churchId: church.id,
      pastorId: pastor.id,
      added: rows.length,
      skipped: feed.episodes.length - fresh.length,
    };
  } catch (err) {
    return {
      feedUrl,
      ok: false,
      added: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Optional discovery: search for the given terms (Podcast Index if configured,
 * else Apple's free search) and add any newly-found feeds to the `feeds` table
 * (active) so they're ingested. Returns how many feeds were added.
 */
export async function discoverFeeds(
  admin: SupabaseClient,
  terms: string[],
  perTerm = 10
): Promise<number> {
  let added = 0;
  for (const term of terms) {
    const candidates = await discover(term, perTerm);
    for (const c of candidates) {
      const res = await admin
        .from("feeds")
        .upsert(
          { kind: "podcast", url: c.url, title: c.title, active: true },
          { onConflict: "kind,url", ignoreDuplicates: true }
        )
        .select("id");
      if (!res.error && res.data && res.data.length > 0) added += 1;
    }
  }
  return added;
}

/**
 * Ingest every active feed. Optionally runs discovery first when
 * INGEST_DISCOVERY_TERMS is set (comma-separated). Records last_scanned_at /
 * last_status on each feed. Returns the per-feed results.
 */
export async function ingestAllFeeds(): Promise<{
  ok: boolean;
  discovered: number;
  results: IngestResult[];
  error?: string;
}> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, discovered: 0, results: [], error: "Supabase service role not configured" };
  }

  // Discovery (opt-in): grow the feed list before scanning.
  let discovered = 0;
  const termsEnv = process.env.INGEST_DISCOVERY_TERMS?.trim();
  if (termsEnv) {
    const terms = termsEnv.split(",").map((t) => t.trim()).filter(Boolean);
    if (terms.length > 0) discovered = await discoverFeeds(admin, terms);
  }

  const feedsRes = await admin
    .from("feeds")
    .select("id, kind, url, active")
    .eq("active", true)
    .eq("kind", "podcast");
  if (feedsRes.error) {
    return { ok: false, discovered, results: [], error: feedsRes.error.message };
  }

  const feeds = (feedsRes.data ?? []) as FeedRow[];
  const results: IngestResult[] = [];

  for (const feed of feeds) {
    const result = await ingestFeed(admin, feed.url);
    results.push(result);
    await admin
      .from("feeds")
      .update({
        last_scanned_at: new Date().toISOString(),
        last_status: result.ok
          ? `ok · +${result.added} new, ${result.skipped} existing`
          : `error · ${result.error ?? "unknown"}`,
      })
      .eq("id", feed.id);
  }

  return { ok: true, discovered, results };
}
