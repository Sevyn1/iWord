// Resync sermons.audio_url with the current enclosure URL from their source feed.
//
// Some publishers (notably Ligonier's daily "Renewing Your Mind") re-publish a
// freshly aired episode within a day under a NEW guid AND a new enclosure URL
// (e.g. rym20260724.mp3 → rym20260724a.mp3). Because ingestion de-dupes by guid
// and never updates existing rows, the sermon keeps pointing at the original
// URL — which the publisher then deletes, so it 404s and won't play.
//
// This re-parses each feed and, for every stored sermon, finds the matching
// current episode (by guid, else by title + publish date) and updates audio_url
// when it has changed and the new URL is actually reachable. It also refreshes
// source_ref so future de-dupes line up again. Sermon id/slug are left untouched
// so existing links and bookmarks keep working.
//
// Usage:  npm run resync:audio          (fix everything)
//         npm run resync:audio -- --dead-only   (only touch rows whose current URL is dead)
// Safe to re-run.

import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const DEAD_ONLY = process.argv.includes("--dead-only");

const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const FEED_UA =
  "iWordBot/1.0 (+https://iword.app) sermon aggregator; contact hello@iword.app";
const ASSET_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: () => false,
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
});

const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function text(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const t = v["#text"];
    if (typeof t === "string") return t;
    if (typeof t === "number") return String(t);
  }
  return "";
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Same enclosure selection as src/lib/ingestion/rss.ts. */
function pickAudio(item) {
  let audioUrl = "";
  for (const enc of toArray(item["enclosure"])) {
    if (!enc || typeof enc !== "object") continue;
    const url = typeof enc["@_url"] === "string" ? enc["@_url"] : "";
    const type = typeof enc["@_type"] === "string" ? enc["@_type"] : "";
    if (!url) continue;
    if (type.startsWith("audio")) return url;
    if (!audioUrl) audioUrl = url;
  }
  return audioUrl;
}

function isoDate(pubDate) {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** URL/DB-safe slug — mirrors slugify() in normalize.ts (without the length cap). */
function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const titleDateKey = (title, isoDay) => `${slugify(title)}|${isoDay}`;

async function fetchFeed(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": FEED_UA,
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Is a media URL reachable? HEAD first, then a 1-byte ranged GET. */
async function isLive(url) {
  for (const init of [
    { method: "HEAD" },
    { method: "GET", headers: { Range: "bytes=0-0" } },
  ]) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": ASSET_UA, ...(init.headers ?? {}) },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status >= 200 && res.status < 400) return true;
    } catch {
      /* try next strategy */
    }
  }
  return false;
}

/** Build indexes of the feed's current episodes: by guid and by title+date. */
function indexFeed(channel) {
  const byGuid = new Map();
  const byTitleDate = new Map();
  for (const item of toArray(channel?.["item"])) {
    if (!item || typeof item !== "object") continue;
    const audioUrl = pickAudio(item);
    if (!audioUrl) continue;
    const guid = text(item["guid"]).trim();
    const title = stripHtml(text(item["title"]));
    const day = isoDate(text(item["pubDate"]));
    const ref = guid || audioUrl;
    const entry = { audioUrl, sourceRef: ref };
    if (guid) byGuid.set(guid, entry);
    if (title && day) byTitleDate.set(titleDateKey(title, day), entry);
  }
  return { byGuid, byTitleDate };
}

async function main() {
  const { data: sermons, error } = await db
    .from("sermons")
    .select("id, title, audio_url, source_ref, feed_url, published_at")
    .eq("source", "podcast");
  if (error) throw new Error(`load sermons: ${error.message}`);

  const withFeed = (sermons ?? []).filter((s) => s.feed_url);
  const byFeed = new Map();
  for (const s of withFeed) {
    if (!byFeed.has(s.feed_url)) byFeed.set(s.feed_url, []);
    byFeed.get(s.feed_url).push(s);
  }

  let updated = 0;
  let unreachableNew = 0;
  let unmatched = 0;

  for (const [feedUrl, rows] of byFeed) {
    let idx;
    try {
      const doc = parser.parse(await fetchFeed(feedUrl));
      const channel = doc?.["rss"]?.["channel"];
      if (!channel) throw new Error("no <channel>");
      idx = indexFeed(channel);
    } catch (e) {
      console.warn(`  skip feed (${e.message}): ${feedUrl}`);
      continue;
    }

    for (const s of rows) {
      const match =
        idx.byGuid.get(s.source_ref) ||
        idx.byTitleDate.get(titleDateKey(s.title, (s.published_at ?? "").slice(0, 10)));
      if (!match) {
        unmatched++;
        continue;
      }
      if (match.audioUrl === s.audio_url) continue; // already current

      // Optionally skip rows whose existing URL still works.
      if (DEAD_ONLY && (await isLive(s.audio_url))) continue;

      // Never replace a working URL with a broken one.
      if (!(await isLive(match.audioUrl))) {
        unreachableNew++;
        console.warn(`  new URL not reachable, leaving as-is: ${s.title}`);
        continue;
      }

      const { error: upErr } = await db
        .from("sermons")
        .update({ audio_url: match.audioUrl, source_ref: match.sourceRef })
        .eq("id", s.id);
      if (upErr) {
        console.warn(`  update failed for ${s.id}: ${upErr.message}`);
        continue;
      }
      updated++;
      console.log(`  fixed: ${s.title}`);
    }
  }

  console.log(
    `\nDone. Updated ${updated} audio URL(s); ${unreachableNew} skipped (new URL dead); ${unmatched} not in current feed window.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
