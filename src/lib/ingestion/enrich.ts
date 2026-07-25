import type { ChurchIdentity, EpisodeEnrichment, NormalizedFeed } from "./types";
import { excerptSummary, hueFromString } from "./normalize";

/**
 * AI enrichment for ingested content.
 *
 * When OPENAI_API_KEY is set, each episode is enriched with a clean summary,
 * a scripture reference, a topic, and tags; and each feed's theme `hue` is
 * derived from its artwork so pages match the church's real branding. Without a
 * key, everything falls back to deterministic heuristics so ingestion still
 * works (just less polished).
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TEXT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const FETCH_TIMEOUT_MS = 30_000;

/** Whether AI enrichment is configured. */
export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type ChatMessage = { role: "system" | "user"; content: ChatContent };

async function callOpenAI(messages: ChatMessage[]): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Cheap heuristic tags: title words minus stopwords. */
function heuristicTags(title: string): string[] {
  const stop = new Set([
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
    "is", "are", "our", "your", "his", "her", "part", "pt", "episode", "ep",
  ]);
  return Array.from(
    new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stop.has(w))
    )
  ).slice(0, 4);
}

function heuristicEnrichment(title: string, description: string): EpisodeEnrichment {
  return {
    summary: excerptSummary(description) || title,
    scripture: "",
    topic: "Message",
    tags: heuristicTags(title),
  };
}

/**
 * Enrich a single episode. Returns AI output when configured, otherwise a
 * deterministic heuristic derived from the episode's own text.
 */
export async function enrichEpisode(
  showTitle: string,
  title: string,
  description: string
): Promise<EpisodeEnrichment> {
  if (!isOpenAIConfigured()) return heuristicEnrichment(title, description);

  const raw = await callOpenAI([
    {
      role: "system",
      content:
        "You are a librarian cataloging Christian sermons for a listening app. " +
        "Given an episode's title and description, return concise, accurate metadata. " +
        "Respond ONLY with JSON matching: " +
        '{"summary": string (1-2 sentences, plain, no marketing fluff), ' +
        '"scripture": string (the single primary Bible reference like "John 3:16-17", or "" if none is clearly indicated), ' +
        '"topic": string (2-4 word theme, Title Case), ' +
        '"tags": string[] (3-5 lowercase single-word themes)}. ' +
        "Do not invent a scripture that isn't supported by the text.",
    },
    {
      role: "user",
      content: `Show: ${showTitle}\nEpisode title: ${title}\nDescription: ${description.slice(0, 1500)}`,
    },
  ]);

  const parsed = safeParse<Partial<EpisodeEnrichment>>(raw);
  if (!parsed) return heuristicEnrichment(title, description);

  const fallback = heuristicEnrichment(title, description);
  return {
    summary: (parsed.summary || "").trim() || fallback.summary,
    scripture: (parsed.scripture || "").trim(),
    topic: (parsed.topic || "").trim() || fallback.topic,
    tags:
      Array.isArray(parsed.tags) && parsed.tags.length > 0
        ? parsed.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.toLowerCase().trim())
            .filter(Boolean)
            .slice(0, 5)
        : fallback.tags,
  };
}

/**
 * Resolve the real-world church behind a sermon feed.
 *
 * Many sermon podcasts are ministries or parachurch networks rather than a
 * single congregation. This maps the feed to the actual church (e.g. Grace to
 * You → Grace Community Church, Truth For Life → Parkside Church) and its
 * senior pastor, using only verifiable facts — or flags it as not a single
 * church (isChurch=false) so the caller can skip it. Returns null when AI is
 * not configured (callers should then skip, since we can't verify identity).
 */
export async function resolveChurchIdentity(
  feed: NormalizedFeed
): Promise<ChurchIdentity | null> {
  if (!isOpenAIConfigured()) return null;

  const raw = await callOpenAI([
    {
      role: "system",
      content:
        "You are a researcher for a directory of real Christian churches. You are given " +
        "metadata from a sermon podcast/RSS feed. Identify the actual, real, verifiable " +
        "church behind it and its senior/founding pastor. Many feeds are published by a " +
        "ministry or broadcast rather than a congregation — when the feed is tied to one " +
        "specific pastor, map it to that pastor's real home or founding church if such a " +
        "church genuinely exists (currently operating or historically real). Examples: " +
        "'Grace to You' → Grace Community Church (John MacArthur, Sun Valley CA); " +
        "'Truth For Life' → Parkside Church (Alistair Begg, Cleveland OH); " +
        "'Ask Pastor John' / 'Desiring God' / 'Light + Truth' → Bethlehem Baptist Church " +
        "(John Piper, Minneapolis MN); 'Gospel in Life' / Tim Keller → Redeemer Presbyterian " +
        "Church (New York NY); 'Renewing Your Mind' / R.C. Sproul → Saint Andrew's Chapel " +
        "(Sanford FL); C.H. Spurgeon → Metropolitan Tabernacle (London). Set isChurch=true and " +
        "fill churchName whenever such a real church exists. Only set isChurch=false and leave " +
        "churchName empty when the feed is a multi-church network or aggregator with no single " +
        "congregation (e.g. The Gospel Coalition), or you genuinely cannot tie it to a real " +
        "church. NEVER invent a church, pastor, location, or website. " +
        "Also classify the feed's format: 'sermon' if its episodes are full " +
        "worship-service sermons/expository preaching, or 'podcast' if it's a " +
        "teaching program, Q&A show, radio broadcast, or topical podcast (e.g. " +
        "'Ask Pastor John' and 'Renewing Your Mind' are 'podcast'; a church's " +
        "Sunday sermon feed is 'sermon'). " +
        "Respond ONLY with JSON matching: " +
        '{"isChurch": boolean, "confidence": number (0-1), ' +
        '"churchName": string (the real church name, "" if none), ' +
        '"pastorName": string (real senior/founding pastor, "" if unknown), ' +
        '"pastorTitle": string (e.g. "Senior Pastor", "Founding Pastor"), ' +
        '"location": string ("City, State/Country", "" if unknown), ' +
        '"denomination": string ("" if nondenominational/unknown), ' +
        '"website": string (official church website starting with https://, "" if unknown), ' +
        '"brandHue": number (0-359, the church website\'s dominant brand color as an HSL hue), ' +
        '"contentType": "sermon" | "podcast"}.',
    },
    {
      role: "user",
      content:
        `Feed title: ${feed.title}\n` +
        `Author: ${feed.author ?? ""}\n` +
        `Website: ${feed.link ?? ""}\n` +
        `Description: ${feed.description.slice(0, 800)}`,
    },
  ]);

  const p = safeParse<Partial<ChurchIdentity>>(raw);
  if (!p) return null;

  // The model sometimes returns confidence on a 0-100 scale; normalize to 0-1.
  let confidence = typeof p.confidence === "number" ? p.confidence : 0;
  if (confidence > 1) confidence = confidence / 100;

  const hue = typeof p.brandHue === "number" && Number.isFinite(p.brandHue)
    ? ((Math.round(p.brandHue) % 360) + 360) % 360
    : hueFromString(feed.title);

  return {
    isChurch: p.isChurch === true,
    confidence,
    churchName: (p.churchName || "").trim(),
    pastorName: (p.pastorName || "").trim(),
    pastorTitle: (p.pastorTitle || "").trim() || "Pastor",
    location: (p.location || "").trim(),
    denomination: (p.denomination || "").trim(),
    website: (p.website || "").trim(),
    brandHue: hue,
    contentType: p.contentType === "sermon" ? "sermon" : "podcast",
  };
}

/**
 * Best theme hue for a church: prefer the real brand color declared on its
 * website (`<meta name="theme-color">` / tile color) when it's a vivid,
 * non-neutral color; otherwise the model's brand-hue guess (when it actually
 * committed to one), else a stable pleasant hue derived from the church name.
 */
export async function deriveChurchHue(identity: ChurchIdentity): Promise<number> {
  if (identity.website) {
    const fromSite = await hueFromWebsite(identity.website);
    if (fromSite !== null) return fromSite;
  }
  // The model's brand-hue guesses are unreliable (it answers a generic blue for
  // almost everything), so we don't trust them. Fall back to a stable, distinct
  // hue derived from the church name instead.
  return hueFromString(identity.churchName || identity.website);
}

/** Fetch a site and read its real brand hue from declared theme colors. */
async function hueFromWebsite(url: string): Promise<number | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const html = await fetchText(url);
  if (!html) return null;

  // 1. Authoritative: a declared theme / tile color.
  const metaPatterns = [
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i,
    /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of metaPatterns) {
    const m = html.match(re);
    const h = m ? vividHue(m[1].trim()) : null;
    if (h !== null) return h;
  }

  // Collect CSS: inline <style> blocks + the first few linked stylesheets.
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join("\n");
  const links = [
    ...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi),
  ]
    .map((m) => m[1])
    .slice(0, 4);
  for (const href of links) {
    try {
      css += "\n" + (await fetchText(new URL(href, url).href)).slice(0, 300_000);
    } catch {
      // ignore individual stylesheet failures
    }
  }

  // 2. A CSS custom property that names a brand/primary/accent color. Skip
  // framework internals (WordPress admin, Bootstrap) that aren't brand colors.
  const varRe =
    /--([a-z0-9-]*(?:brand|primary|accent|theme|main)[a-z0-9-]*)\s*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]+\))/gi;
  for (const m of css.matchAll(varRe)) {
    const name = m[1].toLowerCase();
    if (name.includes("admin") || name.startsWith("bs-") || name.includes("wp-")) continue;
    const h = vividHue(m[2].trim());
    if (h !== null) return h;
  }

  // 3. The most frequent vivid hex color, ignoring common framework/UI defaults
  // (Bootstrap alerts, WordPress admin blue) that would otherwise dominate.
  const FRAMEWORK_DEFAULTS = new Set([
    "a94442", "3c763d", "8a6d3b", "dff0d8", "dc3545", "28a745", "007cba", "d9edf7", "f2dede",
  ]);
  const freq = new Map<string, number>();
  for (const m of (html + css).matchAll(/#([0-9a-f]{6})\b/gi)) {
    const hex = m[1].toLowerCase();
    if (FRAMEWORK_DEFAULTS.has(hex)) continue;
    const hsl = colorToHsl("#" + hex);
    if (hsl && hsl.s >= 0.3 && hsl.l > 0.12 && hsl.l < 0.88) {
      freq.set(hex, (freq.get(hex) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [hex, count] of freq) {
    if (count > bestCount) {
      best = hex;
      bestCount = count;
    }
  }
  // Only trust a dominant color (appears several times), otherwise it's noise.
  if (best && bestCount >= 3) return vividHue("#" + best);
  return null;
}

/** Fetch text with a short timeout and a friendly UA. Empty string on failure. */
async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "iWordBot/1.0 (+https://iword.app)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 400_000);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * True when a URL resolves to a live raster image (2xx + an `image/*`
 * content-type) as seen by a real browser. Sends a browser User-Agent on
 * purpose: some hosts serve images to browsers but 403/redirect known bot
 * agents, and the catalog is ultimately rendered by the browser. Best-effort —
 * any network error resolves to false so the caller simply skips the candidate.
 */
async function imageUrlIsLive(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    return type.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/** Hue of a color string, but only if it's a vivid (non-neutral) color. */
function vividHue(input: string): number | null {
  const hsl = colorToHsl(input);
  if (hsl && hsl.s >= 0.15 && hsl.l > 0.08 && hsl.l < 0.95) return hsl.h;
  return null;
}

/** Parse a hex or rgb() color string into HSL. Returns null if unparseable. */
function colorToHsl(input: string): { h: number; s: number; l: number } | null {
  let r: number, g: number, b: number;
  const hex = input.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (/^[0-9a-f]{6}$/i.test(hex)) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    const m = input.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
    if (!m) return null;
    r = +m[1];
    g = +m[2];
    b = +m[3];
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

/** Resolve a possibly-relative URL against a base; null if unparseable. */
function absUrl(src: string, base: string): string | null {
  try {
    return new URL(decodeEntities(src.trim()), base).href;
  } catch {
    return null;
  }
}

/** Decode the few HTML entities that show up inside attribute URLs. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'");
}

/** True when a URL explicitly requests a tiny (favicon-sized) image. */
function tooSmall(url: string): boolean {
  const m = url.match(/[?&](?:w|width|h|height|size)=(\d+)/i);
  return m ? Number(m[1]) > 0 && Number(m[1]) <= 48 : false;
}

/** Looks like a real raster image (not an inline data URI or SVG sprite). */
function looksLikeImage(url: string): boolean {
  if (/^data:/i.test(url)) return false;
  if (/\.svg(\?|#|$)/i.test(url)) return false;
  return /\.(png|jpe?g|webp|avif)(\?|#|$)/i.test(url) || !/\.[a-z0-9]{2,4}(\?|#|$)/i.test(url);
}

/** Pull the `src` (incl. lazy-load variants) out of an <img> tag string. */
function imgSrc(tag: string): string | null {
  const m =
    tag.match(/\b(?:data-src|data-lazy-src|data-original)=["']([^"']+)["']/i) ||
    tag.match(/\bsrc=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

/**
 * Extract a church's real logo from its website. Prefers a header logo image,
 * then the apple-touch-icon, then the Open Graph image, then a large favicon.
 * Returns an absolute URL or null. No fabrication — only what the site declares.
 */
export async function extractChurchLogo(website: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(website)) return null;
  const html = await fetchText(website);
  if (!html) return null;

  // Gather candidates in priority order, then return the first one that
  // actually resolves to a live image — so a rotated/stale asset URL (e.g. a
  // cache-busted path that later 404s) never lands in the catalog.
  const candidates: string[] = [];
  const add = (url: string | null) => {
    if (url && !candidates.includes(url)) candidates.push(url);
  };

  // 1. An <img> in the markup that is explicitly a logo.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src = imgSrc(tag);
    if (!src) continue;
    const abs = absUrl(src, website);
    if (abs && looksLikeImage(abs) && !tooSmall(abs)) add(abs);
  }

  // 2. apple-touch-icon (usually a clean square brand mark).
  const apple = html.match(
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i
  );
  if (apple) {
    const abs = absUrl(apple[1], website);
    if (abs && !tooSmall(abs)) add(abs);
  }

  // 3. Open Graph / Twitter image.
  const og =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) {
    const abs = absUrl(og[1], website);
    if (abs && looksLikeImage(abs) && !tooSmall(abs)) add(abs);
  }

  // 4. Any icon link as a last resort.
  const icon = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (icon) {
    const abs = absUrl(icon[1], website);
    if (abs && !tooSmall(abs)) add(abs);
  }

  for (const url of candidates) {
    if (await imageUrlIsLive(url)) return url;
  }
  return null;
}

/**
 * Best-effort extract a pastor's real headshot from the church's staff/about
 * page. Only returns an image whose alt text or nearby caption clearly names
 * the pastor, so we never attach the wrong person's photo. Returns null when no
 * confident, name-anchored match is found.
 */
export async function extractPastorHeadshot(
  website: string,
  pastorName: string
): Promise<string | null> {
  if (!/^https?:\/\//i.test(website) || !pastorName.trim()) return null;

  const tokens = pastorName
    .toLowerCase()
    .replace(/\b(rev|dr|pastor|mr|mrs|ms|jr|sr|the)\b\.?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return null;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];

  const home = await fetchText(website);
  if (!home) return null;

  // Candidate staff/about pages linked from the homepage, plus the homepage.
  const pageUrls = new Set<string>([website]);
  for (const m of home.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const href = m[1];
    if (/(staff|about|leadership|our-team|our-people|team|pastors|elders|meet|who-we-are)/i.test(href)) {
      const abs = absUrl(href, website);
      if (abs && abs.startsWith("http")) pageUrls.add(abs);
      if (pageUrls.size >= 5) break;
    }
  }

  const nameMatches = (text: string): boolean => {
    const t = text.toLowerCase();
    return t.includes(last) && (t.includes(first) || t.includes(`${first[0]} ${last}`));
  };

  for (const pageUrl of pageUrls) {
    const html = pageUrl === website ? home : await fetchText(pageUrl);
    if (!html) continue;

    // (a) An <img> whose alt/title names the pastor.
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const alt = (tag.match(/\b(?:alt|title)=["']([^"']+)["']/i)?.[1] ?? "");
      if (!alt || !nameMatches(alt)) continue;
      const src = imgSrc(tag);
      const abs = src ? absUrl(src, pageUrl) : null;
      if (abs && looksLikeImage(abs)) return abs;
    }

    // (b) The pastor's name appears in the text near an <img> (caption layout).
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

/** Fetch + parse JSON with a short timeout and the Wikimedia-required UA. */
async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "iWordBot/1.0 (+https://iword.app)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Descriptions we accept as evidence the page is the right religious figure. */
const RELIGIOUS_FIGURE =
  /\b(pastor|theolog|preacher|minister|evangelist|clergy|apologist|bishop|reverend|priest|christian)\b/i;

/**
 * Look up a verified, freely-licensed portrait from Wikipedia/Wikimedia Commons
 * for a well-known figure. Only returns an image when the matched page's
 * surname matches and its description clearly marks a religious figure, so we
 * never attach the wrong person's photo. This is the reliable source for public
 * preachers when the church website has no name-matched headshot; returns null
 * for anyone without a confident, on-Wikipedia match (e.g. local pastors).
 */
export async function fetchWikimediaHeadshot(
  name: string
): Promise<string | null> {
  const q = name.trim();
  if (q.length < 3) return null;

  const tokens = q
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return null;
  const surname = tokens[tokens.length - 1];

  const searchUrl =
    "https://en.wikipedia.org/w/api.php?action=query&list=search" +
    `&srsearch=${encodeURIComponent(`${q} pastor theologian preacher`)}` +
    "&srlimit=5&format=json&origin=*";
  const search = await fetchJson(searchUrl);
  const hits =
    ((search?.query as Record<string, unknown> | undefined)?.search as
      | Array<{ title?: string }>
      | undefined) ?? [];

  for (const hit of hits) {
    const title = hit.title?.trim();
    // Require the surname to appear in the page title before trusting it.
    if (!title || !title.toLowerCase().includes(surname)) continue;

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title.replace(/ /g, "_")
    )}`;
    const s = await fetchJson(summaryUrl);
    if (!s || s.type === "disambiguation") continue;

    const desc = `${(s.description as string) ?? ""} ${(s.extract as string) ?? ""}`;
    if (!RELIGIOUS_FIGURE.test(desc)) continue;

    const thumb = (s.thumbnail as { source?: string } | undefined)?.source;
    const original = (s.originalimage as { source?: string } | undefined)?.source;
    const img = thumb || original;
    if (img && /^https:\/\/upload\.wikimedia\.org\//.test(img) && looksLikeImage(img)) {
      return img;
    }
  }
  return null;
}
