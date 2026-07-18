// One-off backfill for migration 008: populate church logos, pastor headshots,
// and per-feed content types for the existing catalog. Deterministic + free
// (no AI): logos/headshots are scraped from each church's website; content
// types come from a small curated map (editable afterwards in /admin/content
// and /admin/feeds).
//
// Run AFTER applying supabase/migrations/008_media_and_content_type.sql.
//
// Usage:  node --env-file=.env.local scripts/backfill-media.mjs
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Feeds whose episodes are full sermons rather than a podcast/teaching program.
// Anything not listed here defaults to "podcast".
const SERMON_FEEDS = [
  "thevillagechurch.net",
  "sermonaudio.com", // Parkside / Metropolitan Tabernacle sermon feeds
  "gty.org", // Grace to You — MacArthur sermon audio
  "gospelinlife", // Redeemer — Keller sermons
];

async function get(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "iWordBot/1.0 (+https://iword.app)" },
      redirect: "follow",
      signal: c.signal,
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 400_000);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function absUrl(src, base) {
  try {
    return new URL(decodeEntities(src.trim()), base).href;
  } catch {
    return null;
  }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'");
}

function tooSmall(url) {
  const m = url.match(/[?&](?:w|width|h|height|size)=(\d+)/i);
  return m ? Number(m[1]) > 0 && Number(m[1]) <= 48 : false;
}

function looksLikeImage(url) {
  if (/^data:/i.test(url)) return false;
  if (/\.svg(\?|#|$)/i.test(url)) return false;
  return /\.(png|jpe?g|webp|avif)(\?|#|$)/i.test(url) || !/\.[a-z0-9]{2,4}(\?|#|$)/i.test(url);
}

function imgSrc(tag) {
  const m =
    tag.match(/\b(?:data-src|data-lazy-src|data-original)=["']([^"']+)["']/i) ||
    tag.match(/\bsrc=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function extractChurchLogo(website) {
  if (!/^https?:\/\//i.test(website)) return null;
  const html = await get(website);
  if (!html) return null;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src = imgSrc(tag);
    if (!src) continue;
    const abs = absUrl(src, website);
    if (abs && looksLikeImage(abs) && !tooSmall(abs)) return abs;
  }
  const apple = html.match(
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i
  );
  if (apple) {
    const abs = absUrl(apple[1], website);
    if (abs && !tooSmall(abs)) return abs;
  }
  const og =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) {
    const abs = absUrl(og[1], website);
    if (abs && looksLikeImage(abs) && !tooSmall(abs)) return abs;
  }
  const icon = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (icon) {
    const abs = absUrl(icon[1], website);
    if (abs && !tooSmall(abs)) return abs;
  }
  return null;
}

async function extractPastorHeadshot(website, pastorName) {
  if (!/^https?:\/\//i.test(website) || !pastorName?.trim()) return null;
  const tokens = pastorName
    .toLowerCase()
    .replace(/\b(rev|dr|pastor|mr|mrs|ms|jr|sr|the)\b\.?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return null;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];

  const home = await get(website);
  if (!home) return null;

  const pageUrls = new Set([website]);
  for (const m of home.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const href = m[1];
    if (/(staff|about|leadership|our-team|our-people|team|pastors|elders|meet|who-we-are)/i.test(href)) {
      const abs = absUrl(href, website);
      if (abs && abs.startsWith("http")) pageUrls.add(abs);
      if (pageUrls.size >= 5) break;
    }
  }

  const nameMatches = (text) => {
    const t = text.toLowerCase();
    return t.includes(last) && (t.includes(first) || t.includes(`${first[0]} ${last}`));
  };

  for (const pageUrl of pageUrls) {
    const html = pageUrl === website ? home : await get(pageUrl);
    if (!html) continue;
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const alt = tag.match(/\b(?:alt|title)=["']([^"']+)["']/i)?.[1] ?? "";
      if (!alt || !nameMatches(alt)) continue;
      const src = imgSrc(tag);
      const abs = src ? absUrl(src, pageUrl) : null;
      if (abs && looksLikeImage(abs)) return abs;
    }
    const idx = html.toLowerCase().indexOf(last);
    if (idx >= 0) {
      const window = html.slice(Math.max(0, idx - 900), idx + 300);
      if (nameMatches(window)) {
        const imgs = [...window.matchAll(/<img\b[^>]*>/gi)];
        const nearest = imgs[imgs.length - 1];
        if (nearest) {
          const src = imgSrc(nearest[0]);
          const abs = src ? absUrl(src, pageUrl) : null;
          if (abs && looksLikeImage(abs)) return abs;
        }
      }
    }
  }
  return null;
}

function classifyFeed(url) {
  return SERMON_FEEDS.some((s) => url.includes(s)) ? "sermon" : "podcast";
}

// ── run ──────────────────────────────────────────────────────────────────────

const { data: churches } = await admin
  .from("churches")
  .select("id, name, website")
  .order("name");

console.log(`\nChurch logos (${churches?.length ?? 0}):`);
for (const c of churches ?? []) {
  if (!c.website) {
    console.log(`  · ${c.name} — no website, skipped`);
    continue;
  }
  const logo = await extractChurchLogo(c.website);
  await admin.from("churches").update({ logo_url: logo }).eq("id", c.id);
  console.log(logo ? `  ✓ ${c.name} → ${logo}` : `  · ${c.name} — no logo found (cleared)`);
}

const { data: pastors } = await admin
  .from("pastors")
  .select("id, name, church_id")
  .order("name");
const websiteById = new Map((churches ?? []).map((c) => [c.id, c.website]));

console.log(`\nPastor headshots (${pastors?.length ?? 0}):`);
for (const p of pastors ?? []) {
  const website = websiteById.get(p.church_id);
  if (!website) {
    console.log(`  · ${p.name} — no church website, skipped`);
    continue;
  }
  const shot = await extractPastorHeadshot(website, p.name);
  await admin.from("pastors").update({ image_url: shot }).eq("id", p.id);
  console.log(
    shot ? `  ✓ ${p.name} → ${shot}` : `  · ${p.name} — no confident headshot (cleared stale art)`
  );
}

const { data: feeds } = await admin.from("feeds").select("id, url, title");
console.log(`\nFeed content types (${feeds?.length ?? 0}):`);
for (const f of feeds ?? []) {
  const type = classifyFeed(f.url);
  await admin.from("feeds").update({ content_type: type }).eq("id", f.id);
  await admin
    .from("sermons")
    .update({ content_type: type })
    .eq("source", "podcast")
    .eq("feed_url", f.url);
  console.log(`  ✓ ${f.title || f.url} → ${type}`);
}

console.log("\nDone. Review logos/photos at /admin/content and types at /admin/feeds.\n");
