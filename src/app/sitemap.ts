import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getAllSermons, getAllPastors, getAllChurches } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${SITE_URL}${path}`;

  const [sermons, pastors, churches] = await Promise.all([
    getAllSermons(),
    getAllPastors(),
    getAllChurches(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/sermons"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/churches"), changeFrequency: "weekly", priority: 0.7 },
    { url: url("/pricing"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.3 },
  ];

  const sermonRoutes: MetadataRoute.Sitemap = sermons.map((s) => ({
    url: url(`/sermons/${s.slug}`),
    lastModified: new Date(s.publishedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const pastorRoutes: MetadataRoute.Sitemap = pastors.map((p) => ({
    url: url(`/pastors/${p.slug}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const churchRoutes: MetadataRoute.Sitemap = churches.map((c) => ({
    url: url(`/churches/${c.slug}`),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...sermonRoutes, ...pastorRoutes, ...churchRoutes];
}
