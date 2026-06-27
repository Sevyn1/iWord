import type { Church, Pastor } from "./types";
import { PASTORS } from "./pastors";

/**
 * Demo church directory. Like the pastors, these are fictional to avoid any
 * association with real organizations. Website URLs use the reserved
 * `.example` domain (RFC 2606) as non-resolving placeholders — swap them for
 * each church's real site when the ingestion pipeline goes live.
 *
 * The `hue` ties a church to a colour theme used across its profile page and
 * logo, so each church's page "matches" its own identity.
 */
export const CHURCHES: Church[] = [
  {
    id: "c-living-word",
    slug: "living-word-tabernacle",
    name: "Living Word Tabernacle",
    location: "Lagos, Nigeria",
    denomination: "Pentecostal",
    description:
      "A teaching church in the heart of Lagos focused on the spiritual formation of working professionals across West Africa. Living Word is known for grounded, scripture-first preaching and a thriving midweek community.",
    website: "https://www.livingwordtabernacle.example",
    initials: "LW",
    hue: 32,
    founded: 1998,
  },
  {
    id: "c-cornerstone",
    slug: "cornerstone-fellowship",
    name: "Cornerstone Fellowship",
    location: "London, United Kingdom",
    denomination: "Non-denominational",
    description:
      "An urban congregation weaving classical theology with the quiet realities of city life. Cornerstone gathers across several London sites and is anchored by a rhythm of teaching, chaplaincy, and care.",
    website: "https://www.cornerstonefellowship.example",
    initials: "CF",
    hue: 220,
    founded: 2006,
  },
  {
    id: "c-hilltop",
    slug: "hilltop-community-church",
    name: "Hilltop Community Church",
    location: "Atlanta, Georgia",
    denomination: "Baptist",
    description:
      "A plain-spoken community church that walks through entire books of the Bible together. From twelve members to twelve hundred in a decade, Hilltop has grown around expository preaching and neighbourliness.",
    website: "https://www.hilltopcommunity.example",
    initials: "HC",
    hue: 12,
    founded: 2011,
  },
  {
    id: "c-new-dawn",
    slug: "new-dawn-assembly",
    name: "New Dawn Assembly",
    location: "Kampala, Uganda",
    denomination: "Charismatic",
    description:
      "A worship-led assembly in Kampala where teaching often opens with song and closes with intercession. New Dawn is a home for vibrant praise and a deep culture of prayer.",
    website: "https://www.newdawnassembly.example",
    initials: "ND",
    hue: 145,
    founded: 2003,
  },
  {
    id: "c-mercy-hill",
    slug: "mercy-hill-toronto",
    name: "Mercy Hill Toronto",
    location: "Toronto, Canada",
    denomination: "Non-denominational",
    description:
      "A Toronto church bridging classical theology with the modern questions of second-generation immigrant Christians. Mercy Hill is a thoughtful, multi-ethnic community on the city's east end.",
    website: "https://www.mercyhilltoronto.example",
    initials: "MH",
    hue: 280,
    founded: 2014,
  },
];

export function getChurchById(id: string): Church | undefined {
  return CHURCHES.find((c) => c.id === id);
}

export function getChurchBySlug(slug: string): Church | undefined {
  return CHURCHES.find((c) => c.slug === slug);
}

/** Pastors belonging to a given church, most-followed first. */
export function getPastorsByChurch(churchId: string): Pastor[] {
  return PASTORS.filter((p) => p.churchId === churchId).sort(
    (a, b) => b.followers - a.followers
  );
}

/** The church a pastor belongs to, if any. */
export function getChurchForPastor(pastor: Pastor): Church | undefined {
  return getChurchById(pastor.churchId);
}
