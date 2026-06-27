export type Pastor = {
  id: string;
  slug: string;
  name: string;
  title: string;
  church: string;
  /** Id of the church this pastor belongs to (see churches.ts). */
  churchId: string;
  location: string;
  bio: string;
  /** Two initials used to render the avatar gradient placeholder. */
  initials: string;
  /** Hue (0-360) used to seed the avatar gradient. */
  hue: number;
  followers: number;
};

/**
 * A church profile. Pastors link to a church via `Pastor.churchId`, and the
 * church page gathers those pastors and themes itself with the church's hue.
 * Designed so churches can later be ingested/automated from a real source.
 */
export type Church = {
  id: string;
  slug: string;
  name: string;
  /** City, Country. */
  location: string;
  /** Short descriptor, e.g. "Non-denominational" or "Pentecostal". */
  denomination?: string;
  /** A paragraph describing the church. */
  description: string;
  /** Full external website URL (https://…), shown as a "Visit website" link. */
  website?: string;
  /** Two initials used to render the logo gradient placeholder. */
  initials: string;
  /** Hue (0-360) used to theme the church page and logo. */
  hue: number;
  /** Year the church was founded (optional). */
  founded?: number;
};

export type Sermon = {
  id: string;
  slug: string;
  title: string;
  pastorId: string;
  scripture: string;
  topic: string;
  tags: string[];
  /** ISO date string. */
  publishedAt: string;
  /** Duration in seconds. */
  durationSec: number;
  /** Public URL to the audio file. */
  audioUrl: string;
  summary: string;
  /** Hue used to seed the thumbnail gradient. */
  hue: number;
  viewsThisWeek: number;
  /** AI-generated 60s excerpt URL (optional; same file in demo). */
  excerptUrl?: string;
};

export type SubscriptionTier = {
  id: string;
  name: string;
  priceMonthly: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
};
