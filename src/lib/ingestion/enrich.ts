import type { EpisodeEnrichment, NormalizedFeed } from "./types";
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
 * Derive a theme hue (0-359) for a feed from its artwork so the church/pastor
 * pages match the real branding. Uses an OpenAI vision call on the artwork when
 * configured; otherwise a deterministic hash of the show title.
 */
export async function deriveHue(feed: NormalizedFeed): Promise<number> {
  const fallback = hueFromString(feed.title);
  if (!isOpenAIConfigured() || !feed.artworkUrl) return fallback;

  const raw = await callOpenAI([
    {
      role: "system",
      content:
        "You extract a brand color from artwork. Look at the image and return the " +
        'dominant/most representative brand color as an HSL hue. Respond ONLY with JSON: {"hue": number} ' +
        "where hue is an integer 0-359.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: "What is this artwork's dominant brand hue?" },
        { type: "image_url", image_url: { url: feed.artworkUrl } },
      ],
    },
  ]);

  const parsed = safeParse<{ hue?: number }>(raw);
  const hue = parsed?.hue;
  if (typeof hue === "number" && Number.isFinite(hue)) {
    return ((Math.round(hue) % 360) + 360) % 360;
  }
  return fallback;
}
