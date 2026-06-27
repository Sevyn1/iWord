import type { Pastor } from "./types";

/**
 * Demo pastors. All names are fictional to avoid any unintended association
 * with real public figures. Replace with real, permissioned creators when
 * the ingestion pipeline goes live.
 */
export const PASTORS: Pastor[] = [
  {
    id: "p-tomide",
    slug: "tomide-ade-williams",
    name: "Tomide Ade-Williams",
    title: "Senior Pastor",
    church: "Living Word Tabernacle",
    churchId: "c-living-word",
    location: "Lagos, Nigeria",
    bio: "Teaching pastor focused on the spiritual formation of working professionals across West Africa. Known for grounded, scripture-first messages.",
    initials: "TA",
    hue: 32,
    followers: 48210,
  },
  {
    id: "p-mara",
    slug: "mara-okafor",
    name: "Rev. Mara Okafor",
    title: "Lead Minister",
    church: "Cornerstone Fellowship",
    churchId: "c-cornerstone",
    location: "London, United Kingdom",
    bio: "Pastor, author, and chaplain. Mara's preaching weaves theology with the quiet realities of urban life.",
    initials: "MO",
    hue: 220,
    followers: 31480,
  },
  {
    id: "p-eli",
    slug: "eli-brennan",
    name: "Eli Brennan",
    title: "Pastor",
    church: "Hilltop Community Church",
    churchId: "c-hilltop",
    location: "Atlanta, Georgia",
    bio: "Plain-spoken preacher walking through entire books of the Bible. Eli's congregation has grown from twelve to twelve hundred in a decade.",
    initials: "EB",
    hue: 12,
    followers: 22950,
  },
  {
    id: "p-grace",
    slug: "grace-mukasa",
    name: "Grace Mukasa",
    title: "Pastor & Worship Leader",
    church: "New Dawn Assembly",
    churchId: "c-new-dawn",
    location: "Kampala, Uganda",
    bio: "Worship-leading pastor whose teaching often opens with song and closes with intercession.",
    initials: "GM",
    hue: 145,
    followers: 18760,
  },
  {
    id: "p-jonah",
    slug: "jonah-park",
    name: "Jonah Park",
    title: "Teaching Pastor",
    church: "Mercy Hill Toronto",
    churchId: "c-mercy-hill",
    location: "Toronto, Canada",
    bio: "Bridges classical theology with the modern questions of second-generation immigrant Christians.",
    initials: "JP",
    hue: 280,
    followers: 14320,
  },
];

export function getPastorById(id: string): Pastor | undefined {
  return PASTORS.find((p) => p.id === id);
}

export function getPastorBySlug(slug: string): Pastor | undefined {
  return PASTORS.find((p) => p.slug === slug);
}
