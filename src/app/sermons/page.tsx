import { Suspense } from "react";
import { getAllSermons, getAllPastors, searchSermons } from "@/lib/content";
import { SermonCard } from "@/components/SermonCard";
import { BrowseFilters } from "./BrowseFilters";

export const metadata = {
  title: "Sermons",
  description:
    "Browse gospel messages from pastors around the world. Filter by topic, pastor, and what's trending this week.",
};

type SearchParams = {
  sort?: string;
  pastor?: string;
  topic?: string;
  q?: string;
};

export default async function SermonsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  // Search results default to relevance order; explicit sorts still win.
  const sort = sp.sort ?? (q ? "relevance" : "recent");
  const pastorId = sp.pastor;
  const topic = sp.topic;

  const [allSermons, pastors] = await Promise.all([
    getAllSermons(),
    getAllPastors(),
  ]);

  let items = q ? await searchSermons(q) : [...allSermons];
  if (pastorId) items = items.filter((s) => s.pastorId === pastorId);
  if (topic) items = items.filter((s) => s.topic === topic);
  if (sort === "trending") {
    items.sort((a, b) => b.viewsThisWeek - a.viewsThisWeek);
  } else if (sort === "longest") {
    items.sort((a, b) => b.durationSec - a.durationSec);
  } else if (sort === "shortest") {
    items.sort((a, b) => a.durationSec - b.durationSec);
  } else if (sort !== "relevance") {
    items.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  const topics = Array.from(new Set(allSermons.map((s) => s.topic))).sort();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl text-cream">Browse sermons</h1>
        <p className="text-cream-muted mt-1">
          {items.length} {items.length === 1 ? "sermon" : "sermons"} · sorted by {sortLabel(sort)}
        </p>
      </header>

      <Suspense>
        <BrowseFilters pastors={pastors} topics={topics} />
      </Suspense>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-10 text-center text-cream-muted">
          No sermons match those filters yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((s) => (
            <SermonCard key={s.id} sermon={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function sortLabel(s: string) {
  switch (s) {
    case "relevance": return "relevance";
    case "trending":  return "trending this week";
    case "longest":   return "longest first";
    case "shortest":  return "shortest first";
    default:          return "most recent";
  }
}
