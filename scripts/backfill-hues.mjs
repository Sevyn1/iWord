// One-off backfill: recompute each podcast church's brand hue with the improved
// website-derived logic (meta theme-color -> brand CSS var -> dominant vivid hex
// -> stable name hue) and update the church + its pastors to match.
//
// Usage:  node --env-file=.env.local scripts/backfill-hues.mjs
import { createHash } from "node:crypto";
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function colorToHsl(input) {
  let r, g, b;
  const hex = input.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16);
  } else if (/^[0-9a-f]{6}$/i.test(hex)) {
    r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
  } else {
    const m = input.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
    if (!m) return null; r = +m[1]; g = +m[2]; b = +m[3];
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
  }
  return { h, s, l };
}
function vividHue(input) {
  const hsl = colorToHsl(input);
  if (hsl && hsl.s >= 0.15 && hsl.l > 0.08 && hsl.l < 0.95) return hsl.h;
  return null;
}
function hueFromString(input) {
  const hash = createHash("sha1").update(input).digest();
  return (hash[0] * 256 + hash[1]) % 360;
}
async function fetchText(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "iWordBot/1.0 (+https://iword.app)" }, redirect: "follow", signal: c.signal });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 400000);
  } catch { return ""; } finally { clearTimeout(t); }
}
async function hueFromWebsite(url) {
  if (!/^https?:\/\//i.test(url)) return null;
  const html = await fetchText(url);
  if (!html) return null;
  const metaPatterns = [
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i,
    /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of metaPatterns) { const m = html.match(re); const h = m ? vividHue(m[1].trim()) : null; if (h !== null) return h; }
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const links = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 4);
  for (const href of links) { try { css += "\n" + (await fetchText(new URL(href, url).href)).slice(0, 300000); } catch {} }
  const varRe = /--([a-z0-9-]*(?:brand|primary|accent|theme|main)[a-z0-9-]*)\s*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]+\))/gi;
  for (const m of css.matchAll(varRe)) { const name = m[1].toLowerCase(); if (name.includes("admin") || name.startsWith("bs-") || name.includes("wp-")) continue; const h = vividHue(m[2].trim()); if (h !== null) return h; }
  const FRAMEWORK_DEFAULTS = new Set(["a94442", "3c763d", "8a6d3b", "dff0d8", "dc3545", "28a745", "007cba", "d9edf7", "f2dede"]);
  const freq = new Map();
  for (const m of (html + css).matchAll(/#([0-9a-f]{6})\b/gi)) { const hex = m[1].toLowerCase(); if (FRAMEWORK_DEFAULTS.has(hex)) continue; const hsl = colorToHsl("#" + hex); if (hsl && hsl.s >= 0.3 && hsl.l > 0.12 && hsl.l < 0.88) freq.set(hex, (freq.get(hex) ?? 0) + 1); }
  let best = null, bestCount = 0;
  for (const [hex, count] of freq) if (count > bestCount) { best = hex; bestCount = count; }
  if (best && bestCount >= 3) return vividHue("#" + best);
  return null;
}
async function deriveChurchHue(name, website) {
  if (website) { const s = await hueFromWebsite(website); if (s !== null) return { hue: s, source: "website" }; }
  return { hue: hueFromString(name || website), source: "name" };
}

const { data: churches, error } = await admin
  .from("churches").select("id,name,website,hue").eq("source", "podcast").order("name");
if (error) { console.error(error.message); process.exit(1); }

for (const c of churches) {
  const { hue, source } = await deriveChurchHue(c.name, c.website);
  const u1 = await admin.from("churches").update({ hue }).eq("id", c.id);
  const u2 = await admin.from("pastors").update({ hue }).eq("church_id", c.id).eq("source", "podcast");
  const err = u1.error || u2.error;
  console.log(`${c.name}: ${c.hue} -> ${hue} (${source})${err ? " ERR " + err.message : ""}`);
}
console.log("done");
