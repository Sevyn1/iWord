import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllChurches,
  getChurchBySlug,
  getPastorsByChurch,
  getSermonsByPastor,
} from "@/lib/content";
import { ChurchContentTabs } from "@/components/ChurchContentTabs";
import { formatCount } from "@/lib/format";

export async function generateStaticParams() {
  const churches = await getAllChurches();
  return churches.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const church = await getChurchBySlug(slug);
  return { title: church ? church.name : "Church" };
}

export default async function ChurchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const church = await getChurchBySlug(slug);
  if (!church) notFound();

  const pastors = await getPastorsByChurch(church.id);
  const totalFollowers = pastors.reduce((sum, p) => sum + p.followers, 0);

  // Latest sermons across all of the church's pastors, split by content type.
  const sermonLists = await Promise.all(
    pastors.map((p) => getSermonsByPastor(p.id))
  );
  const allContent = sermonLists
    .flat()
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  const sermonItems = allContent
    .filter((s) => s.contentType !== "podcast")
    .slice(0, 12);
  const podcastItems = allContent
    .filter((s) => s.contentType === "podcast")
    .slice(0, 12);
  const logo = church.logoUrl ?? church.artworkUrl;

  return (
    <div>
      {/* Themed header */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `radial-gradient(90% 130% at 100% 0%, hsl(${(church.hue + 35) % 360} 64% 44% / 0.65), transparent 70%), linear-gradient(165deg, hsl(${church.hue} 56% 32%) 0%, hsl(${church.hue} 52% 19%) 100%)`,
        }}
      >
        {/* decorative motif */}
        <svg
          className="absolute -right-8 -top-8 opacity-[0.10] pointer-events-none"
          width="280" height="280" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        >
          <path d="M12 2v20M5 9h14M8 22h8" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <Link
            href="/churches"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-6"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All churches
          </Link>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={church.name}
                className="h-24 sm:h-32 w-auto max-w-[60%] object-contain object-left shrink-0 drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
              />
            ) : (
              <div
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl flex items-center justify-center text-3xl font-semibold text-white ring-2 ring-white/25 shrink-0 shadow-xl shadow-black/40"
                style={{
                  background: `linear-gradient(135deg, hsl(${church.hue},68%,52%), hsl(${(church.hue + 30) % 360},72%,30%))`,
                }}
              >
                {church.initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-[#EBC67A]">
                {church.denomination ? `${church.denomination} church` : "Church"}
              </p>
              <h1 className="font-display text-3xl sm:text-5xl text-white leading-tight mt-1">
                {church.name}
              </h1>
              {(church.location || church.founded) && (
                <p className="text-white/75 mt-1 flex items-center gap-1.5">
                  {church.location && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
                      <path d="M12 21s-7-5.686-7-11a7 7 0 1114 0c0 5.314-7 11-7 11z" stroke="currentColor" strokeWidth="1.6" />
                      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  )}
                  {church.location}
                  {church.location && church.founded ? ` · Est. ${church.founded}` : church.founded ? `Est. ${church.founded}` : ""}
                </p>
              )}
              <p className="mt-3 text-white/80 max-w-2xl">{church.description}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 ring-1 ring-white/15 px-3.5 py-1.5 text-sm text-white">
                  <span className="font-semibold">{pastors.length}</span>
                  <span className="text-white/70">{pastors.length === 1 ? "pastor" : "pastors"}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 ring-1 ring-white/15 px-3.5 py-1.5 text-sm text-white">
                  <span className="font-semibold">{formatCount(totalFollowers)}</span>
                  <span className="text-white/70">followers</span>
                </span>
                {church.website && (
                  <a
                    href={church.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-[#1B2138] font-medium hover:bg-white/90 transition-colors"
                  >
                    Visit website
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M7 17 17 7M17 7H9m8 0v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pastors at this church */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-display text-2xl text-cream mb-5">
          Pastors at {church.name}
        </h2>
        {pastors.length === 0 ? (
          <p className="text-cream-muted">No pastors listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastors.map((p) => (
              <Link
                key={p.id}
                href={`/pastors/${p.slug}`}
                className="group flex items-center gap-4 rounded-2xl bg-ink-2 ring-1 ring-line p-4 hover:ring-gold/40 hover:bg-ink-3 transition-all"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-14 h-14 rounded-full object-cover ring-1 ring-line shrink-0 bg-white/5"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-semibold text-white ring-1 ring-line shrink-0"
                    style={{
                      background: `linear-gradient(135deg, hsl(${p.hue},65%,38%), hsl(${(p.hue + 30) % 360},70%,22%))`,
                    }}
                  >
                    {p.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-cream font-medium truncate group-hover:text-gold transition-colors">{p.name}</div>
                  <div className="text-cream-muted text-sm truncate">{p.title}</div>
                  <div className="text-cream-faint text-xs mt-0.5">
                    {formatCount(p.followers)} followers
                  </div>
                </div>
                <svg
                  className="text-cream-faint group-hover:text-gold group-hover:translate-x-0.5 transition-all shrink-0"
                  width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Latest content from the church, split into Sermons / Podcast */}
      <ChurchContentTabs
        churchName={church.name}
        sermons={sermonItems}
        podcasts={podcastItems}
      />
    </div>
  );
}
