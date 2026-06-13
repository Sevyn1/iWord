import type { SubscriptionTier } from "./types";

export const TIERS: SubscriptionTier[] = [
  {
    id: "seeker",
    name: "Seeker",
    priceMonthly: 0,
    tagline: "Listen along, free forever.",
    features: [
      "Browse the full sermon library",
      "Stream 3 sermons per month",
      "Weekly trending newsletter",
    ],
  },
  {
    id: "devoted",
    name: "Devoted",
    priceMonthly: 6,
    tagline: "For the everyday listener.",
    features: [
      "Unlimited streaming, ad-free",
      "Download for offline listening",
      "60-second AI excerpts to share",
      "Personalized weekly digest",
    ],
    highlight: true,
  },
  {
    id: "patron",
    name: "Patron",
    priceMonthly: 18,
    tagline: "Support the pastors you love.",
    features: [
      "Everything in Devoted",
      "Support as a patron",
      "Early access to new sermons",
      "Private Q&A threads with selected pastors",
    ],
  },
];
