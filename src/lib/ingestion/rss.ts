import { XMLParser } from "fast-xml-parser";
import type { NormalizedEpisode, NormalizedFeed } from "./types";

/**
 * Podcast/RSS feed parser.
 *
 * Fetches a feed URL and normalizes it into a {@link NormalizedFeed}. Handles
 * the common RSS 2.0 + iTunes-namespace podcast shape (and degrades gracefully
 * on odd feeds). Episodes without a playable audio enclosure are dropped.
 */

const USER_AGENT =
  "iWordBot/1.0 (+https://iword.app) sermon aggregator; contact hello@iword.app";
const FETCH_TIMEOUT_MS = 15_000;
/** Cap episodes parsed per feed so a huge back-catalog can't blow up a run. */
const MAX_EPISODES = 50;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Keep single items as objects; we normalize to arrays ourselves.
  isArray: () => false,
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
});

/** Coerce a value that may be a single item or an array into an array. */
function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Extract text from a node that may be a string or an object with #text. */
function text(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];
    if (typeof t === "string") return t;
    if (typeof t === "number") return String(t);
  }
  return "";
}

/** Strip HTML tags + collapse whitespace to produce a plain-text summary. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse an iTunes duration ("3600", "1:02:03", or "12:34") into seconds. */
export function parseDuration(raw: string): number {
  const value = raw.trim();
  if (!value) return 0;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  const parts = value.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + part;
  return seconds;
}

/** Best-effort ISO date; falls back to now if the pubDate is unparseable. */
function toIso(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Pull an image URL from <itunes:image>, <image>, <media:thumbnail>, or an
 * image-typed <media:content>. Handles single or repeated media nodes. */
function pickImage(node: Record<string, unknown>): string | undefined {
  const itunes = node["itunes:image"];
  if (itunes && typeof itunes === "object") {
    const href = (itunes as Record<string, unknown>)["@_href"];
    if (typeof href === "string" && href) return href;
  }
  const image = node["image"];
  if (image && typeof image === "object") {
    const url = (image as Record<string, unknown>)["url"];
    const t = text(url);
    if (t) return t;
  }
  // <media:thumbnail> always references an image.
  for (const thumb of toArray(node["media:thumbnail"])) {
    if (thumb && typeof thumb === "object") {
      const url = (thumb as Record<string, unknown>)["@_url"];
      if (typeof url === "string" && url) return url;
    }
  }
  // <media:content> only when it is an image (by medium, type, or extension) —
  // e.g. The Village Church attaches per-episode art here rather than itunes:image.
  for (const mc of toArray(node["media:content"])) {
    if (!mc || typeof mc !== "object") continue;
    const m = mc as Record<string, unknown>;
    const url = typeof m["@_url"] === "string" ? (m["@_url"] as string) : "";
    if (!url) continue;
    const medium = typeof m["@_medium"] === "string" ? m["@_medium"] : "";
    const type = typeof m["@_type"] === "string" ? m["@_type"] : "";
    if (
      medium === "image" ||
      type.startsWith("image") ||
      /\.(png|jpe?g|webp|avif|gif)(\?|#|$)/i.test(url)
    ) {
      return url;
    }
  }
  return undefined;
}

/** Choose the first http(s) link when <link> may be a string or an array. */
function pickLink(node: Record<string, unknown>): string | undefined {
  for (const l of toArray(node["link"])) {
    const t = text(l).trim();
    if (t.startsWith("http")) return t;
  }
  return undefined;
}

function normalizeItem(item: Record<string, unknown>): NormalizedEpisode | null {
  // Audio enclosure is required — prefer an audio/* enclosure if several exist.
  const enclosures = toArray(item["enclosure"]);
  let audioUrl = "";
  for (const enc of enclosures) {
    if (!enc || typeof enc !== "object") continue;
    const e = enc as Record<string, unknown>;
    const url = typeof e["@_url"] === "string" ? (e["@_url"] as string) : "";
    const type = typeof e["@_type"] === "string" ? (e["@_type"] as string) : "";
    if (!url) continue;
    if (type.startsWith("audio")) {
      audioUrl = url;
      break;
    }
    if (!audioUrl) audioUrl = url;
  }
  if (!audioUrl) return null;

  const title = stripHtml(text(item["title"])) || "Untitled episode";
  const rawDescription =
    text(item["content:encoded"]) ||
    text(item["description"]) ||
    text(item["itunes:summary"]);
  const description = stripHtml(rawDescription);

  // Stable identifier for de-dup: prefer the guid, else the audio URL.
  const guid = text(item["guid"]).trim();
  const sourceRef = guid || audioUrl;

  return {
    sourceRef,
    title,
    description,
    publishedAt: toIso(text(item["pubDate"])),
    durationSec: parseDuration(text(item["itunes:duration"])),
    audioUrl,
    sourceUrl: pickLink(item),
    artworkUrl: pickImage(item),
  };
}

/**
 * Fetch and parse a podcast feed. Throws on network/HTTP failure or when the
 * document has no recognizable RSS channel.
 */
export async function fetchAndParseFeed(feedUrl: string): Promise<NormalizedFeed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let xml: string;
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  const doc = parser.parse(xml) as Record<string, unknown>;
  const rss = doc["rss"] as Record<string, unknown> | undefined;
  const channel = rss?.["channel"] as Record<string, unknown> | undefined;
  if (!channel) throw new Error("no RSS <channel> found");

  const author =
    stripHtml(text(channel["itunes:author"])) ||
    stripHtml(text(channel["managingEditor"])) ||
    undefined;

  const episodes = toArray(channel["item"])
    .map((i) => normalizeItem(i as Record<string, unknown>))
    .filter((e): e is NormalizedEpisode => e !== null)
    .slice(0, MAX_EPISODES);

  return {
    feedUrl,
    title: stripHtml(text(channel["title"])) || "Untitled feed",
    author,
    description: stripHtml(
      text(channel["description"]) || text(channel["itunes:summary"])
    ),
    link: pickLink(channel),
    artworkUrl: pickImage(channel),
    episodes,
  };
}
