import { Suspense } from "react";
import Link from "next/link";
import { CHURCHES, getPastorsByChurch } from "@/lib/churches";
import { formatCount } from "@/lib/format";
import { ChurchSearch } from "./ChurchSearch";

export const metadata = { title: "Churches — iWord" };

export default async function ChurchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim().toLowerCase();

  let churches = [...CHURCHES].sort((a, b) => a.name.localeCompare(b.name));
  if (q) {
    churches = churches.filter((c) => {
      const pastors = getPastorsByChurch(c.id);
      return (
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        (c.denomination ?? "").toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        pastors.some((p) => p.name.toLowerCase().includes(q))
      );
    });
  }

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
        <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-10 text-center text-cream-muted">
          No churches match your search yet.
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {churches.map((c) => {
          const pastors = getPastorsByChurch(c.id);
          const followers = pastors.reduce((sum, p) => sum + p.followers, 0);
          return (
            <Link
              key={c.id}
              href={`/churches/${c.slug}`}
              className="group rounded-3xl ring-1 ring-line bg-ink-2 hover:bg-ink-3 transition-colors overflow-hidden"
            >
              <div
                className="h-20"
                style={{
                  background: `linear-gradient(135deg, hsl(${c.hue},55%,32%), hsl(${(c.hue + 30) % 360},60%,18%))`,
                }}
              />
              <div className="px-5 pb-5 -mt-9">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-semibold text-cream ring-2 ring-ink-2 shadow-lg shadow-black/40"
                  style={{
                    background: `linear-gradient(135deg, hsl(${c.hue},65%,38%), hsl(${(c.hue + 30) % 360},70%,22%))`,
                  }}
                >
                  {c.initials}
                </div>
                <h2 className="mt-3 font-display text-xl text-cream group-hover:text-gold transition-colors">
                  {c.name}
                </h2>
                <p className="text-cream-muted text-sm mt-0.5">{c.location}</p>
                <p className="text-cream-faint text-xs mt-2">
                  {pastors.length} {pastors.length === 1 ? "pastor" : "pastors"} ·{" "}
                  {formatCount(followers)} followers
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
