// Backfill sermons.image_url with per-episode artwork from their source feeds.
//
// Existing sermons were ingested before we stored per-episode art, so their
// image_url is null and they fall back to the church's podcast cover. This
// re-parses each feed, matches episodes by source_ref (guid ?? enclosure url),
// and fills in the individual episode artwork where the feed provides it.
//
// Usage:  npm run backfill:sermon-art
// Safe to re-run; only updates rows whose image_url is still null.

import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const USER_AGENT =
  "iWordBot/1.0 (+https://iword.app) sermon aggregator; contact hello@iword.app";

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

function pickImage(node) {
  const itunes = node["itunes:image"];
  if (itunes && typeof itunes === "object") {
    const href = itunes["@_href"];
    if (typeof href === "string" && href) return href;
  }
  const image = node["image"];
  if (image && typeof image === "object") {
    const url = text(image["url"]);
    if (url) return url;
  }
  return undefined;
}

/** Map every episode's source_ref (guid ?? audio url) to its artwork. */
function episodeArtByRef(channel) {
  const map = new Map();
  for (const item of toArray(channel?.["item"])) {
    if (!item || typeof item !== "object") continue;
    // enclosure url (first audio/*, else first with a url)
    let audioUrl = "";
    for (const enc of toArray(item["enclosure"])) {
      if (!enc || typeof enc !== "object") continue;
      const url = typeof enc["@_url"] === "string" ? enc["@_url"] : "";
      const type = typeof enc["@_type"] === "string" ? enc["@_type"] : "";
      if (!url) continue;
      if (type.startsWith("audio")) { audioUrl = url; break; }
      if (!audioUrl) audioUrl = url;
    }
    const guid = text(item["guid"]).trim();
    const sourceRef = guid || audioUrl;
    if (!sourceRef) continue;
    const art = pickImage(item);
    if (art) map.set(sourceRef, art);
  }
  return map;
}

async function fetchFeed(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
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

async function main() {
  // Only podcast sermons that still lack their own art and have a feed + ref.
  const { data: sermons, error } = await db
    .from("sermons")
    .select("id, source_ref, feed_url, image_url")
    .eq("source", "podcast")
    .is("image_url", null);
  if (error) throw new Error(`load sermons: ${error.message}`);

  const missing = (sermons ?? []).filter((s) => s.source_ref && s.feed_url);
  if (missing.length === 0) {
    console.log("Nothing to backfill — every sermon already has image_url.");
    return;
  }

  // Group by feed so each feed is fetched once.
  const byFeed = new Map();
  for (const s of missing) {
    if (!byFeed.has(s.feed_url)) byFeed.set(s.feed_url, []);
    byFeed.get(s.feed_url).push(s);
  }

  let updated = 0;
  let noArt = 0;
  for (const [feedUrl, rows] of byFeed) {
    let artByRef;
    try {
      const xml = await fetchFeed(feedUrl);
      const doc = parser.parse(xml);
      const channel = doc?.["rss"]?.["channel"];
      if (!channel) throw new Error("no <channel>");
      artByRef = episodeArtByRef(channel);
    } catch (e) {
      console.warn(`  skip feed (${e.message}): ${feedUrl}`);
      continue;
    }

    for (const s of rows) {
      const art = artByRef.get(s.source_ref);
      if (!art) { noArt++; continue; }
      const { error: upErr } = await db
        .from("sermons")
        .update({ image_url: art })
        .eq("id", s.id);
      if (upErr) {
        console.warn(`  update failed for ${s.id}: ${upErr.message}`);
        continue;
      }
      updated++;
    }
    console.log(`  ${feedUrl} → ${rows.length} rows scanned`);
  }

  console.log(
    `\nDone. Updated ${updated} sermon(s); ${noArt} had no per-episode art (church cover stays as fallback).`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
