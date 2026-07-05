import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { Sermon, Pastor, Church } from "@/lib/types";

type Json = Record<string, unknown>;

const abs = (path: string) => `${SITE_URL}${path}`;

/** Convert seconds into an ISO-8601 duration (e.g. 1830 -> "PT30M30S"). */
function isoDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${sec || (!h && !m) ? `${sec}S` : ""}`;
}

/** The iWord brand as a schema.org Organization. */
export function organizationJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: abs("/opengraph-image"),
  };
}

/** The site itself, with a sitelinks search box wired to /sermons?q=. */
export function websiteJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: abs("/sermons?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** A sermon as an AudioObject authored by its pastor. */
export function sermonJsonLd(sermon: Sermon, pastor?: Pastor): Json {
  const data: Json = {
    "@context": "https://schema.org",
    "@type": "AudioObject",
    name: sermon.title,
    description: sermon.summary,
    url: abs(`/sermons/${sermon.slug}`),
    thumbnailUrl: abs(`/sermons/${sermon.slug}/opengraph-image`),
    uploadDate: new Date(sermon.publishedAt).toISOString(),
    duration: isoDuration(sermon.durationSec),
    inLanguage: "en",
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
  if (sermon.scripture) data.about = sermon.scripture;
  if (pastor) {
    data.author = {
      "@type": "Person",
      name: pastor.name,
      url: abs(`/pastors/${pastor.slug}`),
    };
  }
  return data;
}

/** A pastor as a schema.org Person. */
export function pastorJsonLd(pastor: Pastor, church?: Church): Json {
  const data: Json = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: pastor.name,
    url: abs(`/pastors/${pastor.slug}`),
    image: abs(`/pastors/${pastor.slug}/opengraph-image`),
  };
  if (pastor.title) data.jobTitle = pastor.title;
  if (pastor.bio) data.description = pastor.bio;
  if (pastor.location) data.homeLocation = { "@type": "Place", name: pastor.location };
  if (church) {
    data.worksFor = {
      "@type": "Organization",
      name: church.name,
      url: abs(`/churches/${church.slug}`),
      ...(church.website ? { sameAs: church.website } : {}),
    };
  } else if (pastor.church) {
    data.worksFor = { "@type": "Organization", name: pastor.church };
  }
  return data;
}

/** A breadcrumb trail. Pass [{ name, path }] from root to current page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}
