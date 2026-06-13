/**
 * Lightweight geo resolver for the demo's "Trending near you" feature.
 *
 * Profile locations are free text (e.g. "Hamilton") and pastor locations are
 * "City, Region" strings. We map both to a coarse country so we can match a
 * listener to creators in the same country without a real geocoding service.
 * Replace with proper geocoding when location data becomes structured.
 */
const PLACE_TO_COUNTRY: Record<string, string> = {
  // Canada
  canada: "Canada",
  hamilton: "Canada",
  toronto: "Canada",
  ottawa: "Canada",
  montreal: "Canada",
  vancouver: "Canada",
  calgary: "Canada",
  // Nigeria
  nigeria: "Nigeria",
  lagos: "Nigeria",
  abuja: "Nigeria",
  ibadan: "Nigeria",
  // United Kingdom
  "united kingdom": "United Kingdom",
  uk: "United Kingdom",
  england: "United Kingdom",
  london: "United Kingdom",
  manchester: "United Kingdom",
  // United States
  "united states": "United States",
  usa: "United States",
  us: "United States",
  atlanta: "United States",
  georgia: "United States",
  "new york": "United States",
  chicago: "United States",
  // Uganda
  uganda: "Uganda",
  kampala: "Uganda",
};

/**
 * Resolve a free-text location to a coarse country, or null if unknown.
 * Tries the whole string, then each comma/space-separated token.
 */
export function resolveCountry(location: string | null | undefined): string | null {
  if (!location) return null;
  const normalized = location.toLowerCase().trim();
  if (PLACE_TO_COUNTRY[normalized]) return PLACE_TO_COUNTRY[normalized];

  // Try the segment after the last comma first (usually the most specific
  // region/country), then every individual word.
  const segments = normalized.split(",").map((s) => s.trim());
  for (const segment of segments.reverse()) {
    if (PLACE_TO_COUNTRY[segment]) return PLACE_TO_COUNTRY[segment];
  }
  for (const token of normalized.split(/[\s,]+/)) {
    if (PLACE_TO_COUNTRY[token]) return PLACE_TO_COUNTRY[token];
  }
  return null;
}
