import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAndParseFeed } from "./rss";
import {
  deriveChurchHue,
  enrichEpisode,
  extractChurchLogo,
  extractPastorHeadshot,
  fetchWikimediaHeadshot,
  resolveChurchIdentity,
} from "./enrich";
import { discover } from "./discovery";
import {
  episodeToSermon,
  feedToChurchAndPastor,
  slugify,
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

    // The feed row caches the resolved church/pastor so we only pay for the AI
    // identity call once per feed (the first time we see it).
    const feedRow = await admin
      .from("feeds")
      .select("id, church_id, pastor_id, content_type")
      .eq("kind", "podcast")
      .eq("url", feedUrl)
      .maybeSingle();
    const feedRowId = (feedRow.data?.id as string | undefined) ?? null;
    let churchId = (feedRow.data?.church_id as string | null) ?? null;
    let pastorId = (feedRow.data?.pastor_id as string | null) ?? null;
    let contentType: "sermon" | "podcast" =
      feedRow.data?.content_type === "podcast" ? "podcast" : "sermon";

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

    // Some publishers (notably Ligonier's daily "Renewing Your Mind") re-publish
    // a just-aired episode within a day under a NEW guid AND enclosure URL,
    // deleting the original file. De-duping by source_ref alone would (a) leave
    // the stored row pointing at a now-dead URL and (b) re-insert the re-publish
    // as a duplicate (new guid → new id). So we also match current feed items to
    // existing sermons by title + publish date, and when one has rotated we
    // refresh its audio_url/source_ref in place instead of inserting a dupe.
    const dayKey = (title: string, publishedAt: string | null | undefined) =>
      `${slugify(title)}|${(publishedAt ?? "").slice(0, 10)}`;

    const existingInFeed = await admin
      .from("sermons")
      .select("id, title, audio_url, source_ref, published_at")
      .eq("source", "podcast")
      .eq("feed_url", feedUrl);
    if (existingInFeed.error) {
      throw new Error(`refresh query: ${existingInFeed.error.message}`);
    }
    const byTitleDate = new Map<
      string,
      { id: string; audioUrl: string; sourceRef: string }
    >();
    for (const r of existingInFeed.data ?? []) {
      const row = r as {
        id: string;
        title: string;
        audio_url: string;
        source_ref: string;
        published_at: string | null;
      };
      byTitleDate.set(dayKey(row.title, row.published_at), {
        id: row.id,
        audioUrl: row.audio_url,
        sourceRef: row.source_ref,
      });
    }

    // Refresh rotated re-publishes and mark them as seen so they are not treated
    // as fresh below. Best-effort: a rare title+date collision must not abort the
    // whole run, so update failures are swallowed.
    const rotatedRefs = new Set<string>();
    for (const e of feed.episodes) {
      if (seen.has(e.sourceRef)) continue; // already stored under this guid
      const match = byTitleDate.get(dayKey(e.title, e.publishedAt));
      if (!match) continue; // genuinely new episode
      rotatedRefs.add(e.sourceRef);
      if (e.audioUrl && e.audioUrl !== match.audioUrl) {
        const refresh = await admin
          .from("sermons")
          .update({ audio_url: e.audioUrl, source_ref: e.sourceRef })
          .eq("id", match.id);
        if (refresh.error) {
          console.warn(
            `audio refresh skipped for ${match.id}: ${refresh.error.message}`
          );
        }
      }
    }

    const fresh: NormalizedEpisode[] = feed.episodes
      .filter((e) => !seen.has(e.sourceRef) && !rotatedRefs.has(e.sourceRef))
      .slice(0, MAX_NEW_PER_FEED);

    let hue = 0;
    if (churchId) {
      // Already resolved on a previous run: reuse the church + stored hue, no
      // paid AI identity call. Idle runs with nothing new cost $0.
      const ch = await admin
        .from("churches")
        .select("hue")
        .eq("id", churchId)
        .maybeSingle();
      hue = typeof ch.data?.hue === "number" ? (ch.data.hue as number) : 0;
      if (fresh.length === 0) {
        return {
          feedUrl,
          ok: true,
          churchId,
          pastorId: pastorId ?? undefined,
          added: 0,
          skipped: feed.episodes.length,
        };
      }
    } else {
      // First time we've seen this feed: resolve the real church behind it. We
      // only surface real, verifiable churches — a feed that maps to no single
      // congregation (a parachurch network like TGC) is skipped, and the feed
      // is deactivated so we never pay to re-resolve it on future runs.
      const identity = await resolveChurchIdentity(feed);
      if (!identity || !identity.churchName || identity.confidence < 0.5) {
        if (feedRowId) {
          await admin
            .from("feeds")
            .update({ active: false, last_status: "skipped: no real church identified" })
            .eq("id", feedRowId);
        }
        return {
          feedUrl,
          ok: true,
          added: 0,
          skipped: feed.episodes.length,
          error: "skipped: no real church identified",
        };
      }
      hue = await deriveChurchHue(identity);
      contentType = identity.contentType;

      // Best-effort: pull the church's real logo and the pastor's headshot from
      // the church website. Both are optional and only set when found (a
      // headshot only when its alt/caption clearly names the pastor). When the
      // site yields no headshot, fall back to a verified, freely-licensed
      // Wikipedia/Wikimedia portrait (name + religious-figure checked).
      const pastorName = identity.pastorName || feed.author?.trim() || "";
      const [logoUrl, siteHeadshot] = identity.website
        ? await Promise.all([
            extractChurchLogo(identity.website),
            extractPastorHeadshot(identity.website, pastorName),
          ])
        : [null, null];
      const headshotUrl =
        siteHeadshot ||
        (pastorName ? await fetchWikimediaHeadshot(pastorName) : null);

      const { church, pastor } = feedToChurchAndPastor(feed, identity, hue, {
        logoUrl,
        headshotUrl,
      });

      // Upsert the church + pastor (idempotent on the identity-based id, so
      // multiple feeds for the same church merge into one row).
      const churchUpsert = await admin
        .from("churches")
        .upsert(church, { onConflict: "id" });
      if (churchUpsert.error) throw new Error(`church upsert: ${churchUpsert.error.message}`);

      const pastorUpsert = await admin
        .from("pastors")
        .upsert(pastor, { onConflict: "id" });
      if (pastorUpsert.error) throw new Error(`pastor upsert: ${pastorUpsert.error.message}`);

      churchId = church.id;
      pastorId = pastor.id;
      if (feedRowId) {
        await admin
          .from("feeds")
          .update({ church_id: churchId, pastor_id: pastorId, content_type: contentType })
          .eq("id", feedRowId);
      }
    }

    if (fresh.length === 0) {
      return {
        feedUrl,
        ok: true,
        churchId,
        pastorId: pastorId ?? undefined,
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
        episodeToSermon(feed, episode, churchId, pastorId ?? churchId, hue, enrichment, contentType)
      );
    }

    const insert = await admin
      .from("sermons")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (insert.error) throw new Error(`sermon insert: ${insert.error.message}`);

    return {
      feedUrl,
      ok: true,
      churchId,
      pastorId: pastorId ?? undefined,
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
