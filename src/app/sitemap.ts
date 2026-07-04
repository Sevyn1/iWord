import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { SERMONS } from "@/lib/sermons";
import { PASTORS } from "@/lib/pastors";
import { CHURCHES } from "@/lib/churches";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE_URL}${path}`;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/sermons"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/churches"), changeFrequency: "weekly", priority: 0.7 },
    { url: url("/pricing"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.3 },
  ];

  const sermonRoutes: MetadataRoute.Sitemap = SERMONS.map((s) => ({
    url: url(`/sermons/${s.slug}`),
    lastModified: new Date(s.publishedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const pastorRoutes: MetadataRoute.Sitemap = PASTORS.map((p) => ({
    url: url(`/pastors/${p.slug}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const churchRoutes: MetadataRoute.Sitemap = CHURCHES.map((c) => ({
    url: url(`/churches/${c.slug}`),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...sermonRoutes, ...pastorRoutes, ...churchRoutes];
}
