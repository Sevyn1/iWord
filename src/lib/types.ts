export type Pastor = {
  id: string;
  slug: string;
  name: string;
  title: string;
  church: string;
  location: string;
  bio: string;
  /** Two initials used to render the avatar gradient placeholder. */
  initials: string;
  /** Hue (0-360) used to seed the avatar gradient. */
  hue: number;
  followers: number;
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
