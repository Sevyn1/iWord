import { Suspense } from "react";
import Link from "next/link";
import type { Pastor } from "@/lib/types";
import { getAllChurches, getAllPastors } from "@/lib/content";
import { formatCount } from "@/lib/format";
import { ChurchSearch } from "./ChurchSearch";

export const metadata = { title: "Churches" };

export default async function ChurchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim().toLowerCase();

  const [allChurches, allPastors] = await Promise.all([
    getAllChurches(),
    getAllPastors(),
  ]);

  // Group pastors by church once (most-followed first) to avoid per-card async.
  const pastorsByChurch = new Map<string, Pastor[]>();
  for (const p of allPastors) {
    const list = pastorsByChurch.get(p.churchId) ?? [];
    list.push(p);
    pastorsByChurch.set(p.churchId, list);
  }
  for (const list of pastorsByChurch.values()) {
    list.sort((a, b) => b.followers - a.followers);
  }
  const pastorsFor = (churchId: string) => pastorsByChurch.get(churchId) ?? [];

  let churches = [...allChurches].sort((a, b) => a.name.localeCompare(b.name));
  if (q) {
    churches = churches.filter((c) => {
      const pastors = pastorsFor(c.id);
      return (
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        (c.denomination ?? "").toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        pastors.some((p) => p.name.toLowerCase().includes(q))
      );
    });
  }

  const totalPastors = allPastors.length;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-gold mb-2">Churches</p>
        <h1 className="font-display text-3xl sm:text-4xl text-cream">
          Churches on iWord
        </h1>
        <p className="text-cream-muted mt-1 max-w-2xl">
          The congregations behind the voices you follow. Explore a church to
          meet its pastors and hear its latest messages.
        </p>
        <p className="text-cream-faint text-sm mt-3">
          {allChurches.length} churches · {totalPastors} pastors
        </p>
      </header>

      <div className="mb-8">
        <Suspense>
          <ChurchSearch />
        </Suspense>
        {q && (
          <p className="text-cream-faint text-sm mt-3">
            {churches.length} {churches.length === 1 ? "church" : "churches"} matching “{q}”
          </p>
        )}
      </div>

      {churches.length === 0 ? (
        <div className="rounded-3xl bg-ink-2 ring-1 ring-line p-12 text-center">
          <p className="text-cream font-display text-lg">No churches found</p>
          <p className="text-cream-muted text-sm mt-1">
            Try a different name, location, or denomination.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {churches.map((c) => {
          const pastors = pastorsFor(c.id);
          const followers = pastors.reduce((sum, p) => sum + p.followers, 0);
          return (
            <Link
              key={c.id}
              href={`/churches/${c.slug}`}
              className="group relative flex flex-col rounded-3xl ring-1 ring-line bg-ink-2 hover:ring-gold/40 hover:-translate-y-1 transition-all duration-200 overflow-hidden"
            >
              <div
                className="relative h-24"
                style={{
                  background: `linear-gradient(135deg, hsl(${c.hue},55%,32%), hsl(${(c.hue + 40) % 360},60%,16%))`,
                }}
              >
                {/* decorative motif */}
                <svg
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-15"
                  width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                >
                  <path d="M12 2v20M5 9h14M8 22h8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {c.denomination && (
                  <span className="absolute right-4 top-4 rounded-full bg-black/25 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/15">
                    {c.denomination}
                  </span>
                )}
              </div>
              <div className="px-5 pb-5 -mt-10 flex flex-col flex-1">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-semibold text-white ring-2 ring-ink-2 shadow-lg shadow-black/20"
                  style={{
                    background: `linear-gradient(135deg, hsl(${c.hue},65%,38%), hsl(${(c.hue + 30) % 360},70%,22%))`,
                  }}
                >
                  {c.initials}
                </div>
                <h2 className="mt-3 font-display text-xl text-cream group-hover:text-gold transition-colors">
                  {c.name}
                </h2>
                <p className="text-cream-muted text-sm mt-0.5 flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-cream-faint">
                    <path d="M12 21s-7-5.686-7-11a7 7 0 1114 0c0 5.314-7 11-7 11z" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  {c.location}
                  {c.founded ? ` · Est. ${c.founded}` : ""}
                </p>
                <p className="text-cream-muted/80 text-sm mt-2 line-clamp-2">
                  {c.description}
                </p>
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {pastors.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-ink-2"
                          style={{
                            background: `linear-gradient(135deg, hsl(${p.hue},65%,38%), hsl(${(p.hue + 30) % 360},70%,22%))`,
                          }}
                        >
                          {p.initials}
                        </div>
                      ))}
                    </div>
                    <span className="text-cream-faint text-xs">
                      {pastors.length} {pastors.length === 1 ? "pastor" : "pastors"} ·{" "}
                      {formatCount(followers)} followers
                    </span>
                  </div>
                  <svg
                    className="text-cream-faint group-hover:text-gold group-hover:translate-x-0.5 transition-all"
                    width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
