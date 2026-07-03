/** Shared site-wide constants for metadata, social sharing, and OG images. */

export const SITE_NAME = "iWord";
export const SITE_TAGLINE = "Gospel messages, gathered with care";
export const SITE_DESCRIPTION =
  "Listen to sermons from beloved pastors around the world. Subscribe, follow, and carry the message with you wherever you go.";

/**
 * Canonical site origin, used for `metadataBase` and absolute share URLs.
 * Override per environment with NEXT_PUBLIC_SITE_URL.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://i-word-iota.vercel.app";
