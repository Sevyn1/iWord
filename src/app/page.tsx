import Link from "next/link";
import { SermonCard } from "@/components/SermonCard";
import { getRecent, getTrending, getAllSermons, getAllPastors } from "@/lib/content";
import { getFollowedPastorIds } from "@/lib/follows";
import { PastorAvatar } from "@/components/PastorAvatar";
import { resolveCountry } from "@/lib/geo";
import { Logo } from "@/components/Logo";
import { DigestSignup } from "@/components/DigestSignup";
import { Thumbnail } from "@/components/Thumbnail";
import { NowPlayingTicker } from "@/components/NowPlayingTicker";
import { formatCount } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";

export default async function HomePage() {
  const [trending, recent, allSermons, pastors] = await Promise.all([
    getTrending(6),
    getRecent(4),
    getAllSermons(),
    getAllPastors(),
  ]);
  const hero = trending[0];
  const heroPastor = hero?.pastor;
  const totalListensThisWeek = allSermons.reduce((sum, s) => sum + s.viewsThisWeek, 0);
  const pastorById = new Map(pastors.map((p) => [p.id, p]));

  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const signedIn = Boolean(user);

  // Personalized feed: latest sermons from the pastors the user follows.
  const followedIds = signedIn ? await getFollowedPastorIds() : new Set<string>();
  const followedSermons = followedIds.size
    ? [...allSermons]
        .filter((s) => followedIds.has(s.pastorId))
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        )
        .slice(0, 4)
    : [];

  // "Trending near you": match the listener's country to pastors in the same
  // country, then take the most-watched sermons among them.
  let userLocation = "";
  if (user) {
    const { data: profile } = await supabase!
      .from("profiles")
      .select("location")
      .eq("id", user.id)
      .single();
    userLocation =
      profile?.location ||
      (user.user_metadata?.location as string | undefined) ||
      "";
  }
  const nearbyCountry = resolveCountry(userLocation);
  const nearbySermons = nearbyCountry
    ? [...allSermons]
        .sort((a, b) => b.viewsThisWeek - a.viewsThisWeek)
        .filter((s) => {
          const p = pastorById.get(s.pastorId);
          return p && resolveCountry(p.location) === nearbyCountry;
        })
        .slice(0, 4)
    : [];

  return (
    <div>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      {/* Hero */}
      <section className="bg-grain border-b border-line relative overflow-hidden">
        {/* soft halo behind hero card */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-32 w-[40rem] h-[40rem] rounded-full blur-3xl opacity-30"
          style={{ background: hero ? `radial-gradient(closest-side, hsl(${hero.hue},80%,55%), transparent)` : undefined }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div className="fade-up">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gold mb-6">
              <Logo size={16} showWordmark={false} />
              Gospel messages, gathered with care
            </span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.02] text-cream">
              Your favourite pastors.
              <br />
              <span className="text-gold">One quiet place.</span>
            </h1>
            <p className="mt-6 text-lg text-cream-muted max-w-xl leading-relaxed">
              iWord brings beloved sermons from around the world into a single
              library. Stream on the train, follow the pastors you love, and
              share a 60‑second excerpt with a friend who needs it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sermons"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot active:scale-95 transition-all shadow-lg shadow-gold/20"
              >
                Start listening
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3.5 rounded-full bg-ink-3/70 backdrop-blur text-cream hover:bg-ink-4 transition-colors ring-1 ring-line"
              >
                See plans
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-5 text-sm text-cream-muted">
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-leaf live-dot" />
                {formatCount(totalListensThisWeek)} listens this week
              </span>
              <span className="hidden sm:inline text-cream-faint">·</span>
              <span className="hidden sm:inline">Free to browse, $6/mo to go ad-free</span>
            </div>
          </div>

          {hero && (
            <Link
              href={`/sermons/${hero.slug}`}
              className="group block fade-up"
              style={{ animationDelay: "120ms" }}
            >
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-gold/30 via-rose/10 to-transparent blur-2xl opacity-60 group-hover:opacity-90 transition-opacity" aria-hidden />
                <div className="relative rounded-2xl overflow-hidden ring-1 ring-line shadow-xl shadow-black/20 group-hover:shadow-2xl group-hover:shadow-black/25 transition-shadow">
                  <Thumbnail title={hero.title} hue={hero.hue} label={hero.scripture} imageUrl={hero.imageUrl} hideText size="lg" className="!ring-0 !rounded-none transition-transform duration-700 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                  <div className="absolute left-5 top-5 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-gold text-ink text-[10px] uppercase tracking-[0.18em] font-medium">
                      Trending #1
                    </span>
                  </div>
                  <div className="absolute inset-x-5 bottom-5">
                    {heroPastor && (
                      <div className="flex items-center gap-3 mb-3">
                        <PastorAvatar
                          imageUrl={heroPastor.imageUrl}
                          name={heroPastor.name}
                          initials={heroPastor.initials}
                          hue={heroPastor.hue}
                          className="w-10 h-10 rounded-full text-xs ring-1 ring-white/30"
                        />
                        <div className="text-sm">
                          <div className="text-white font-medium">{heroPastor.name}</div>
                          <div className="text-white/70 text-xs">{heroPastor.church}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#EBC67A] mb-1">{hero.scripture}</div>
                        <div className="font-display text-2xl sm:text-3xl text-white leading-tight">{hero.title}</div>
                      </div>
                      <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold text-ink group-hover:bg-gold-hot transition-colors shadow-lg shadow-black/40">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7 5.5a1 1 0 0 1 1.55-.83l10 6.5a1 1 0 0 1 0 1.66l-10 6.5A1 1 0 0 1 7 18.5v-13Z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      <NowPlayingTicker sermons={trending} />

      {/* From pastors you follow (personalized) */}
      {followedSermons.length > 0 && (
        <Section
          title="From pastors you follow"
          action={
            <Link href="/following" className="text-sm text-cream-muted hover:text-cream">
              See all →
            </Link>
          }
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {followedSermons.map((s, i) => (
              <SermonCard key={s.id} sermon={s} delayMs={i * 70} />
            ))}
          </div>
        </Section>
      )}

      {/* Trending near you (personalized by location) */}
      {nearbySermons.length > 0 && (
        <Section
          title="Trending near you"
          action={
            <span className="text-sm text-cream-muted">
              Near {userLocation} · {nearbyCountry}
            </span>
          }
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {nearbySermons.map((s, i) => (
              <SermonCard key={s.id} sermon={s} delayMs={i * 70} />
            ))}
          </div>
        </Section>
      )}

      {/* Trending */}
      <Section
        title="Trending this week"
        action={<Link href="/sermons?sort=trending" className="text-sm text-cream-muted hover:text-cream">See all →</Link>}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {trending.slice(0, 4).map((s, i) => (
            <SermonCard key={s.id} sermon={s} delayMs={i * 70} />
          ))}
        </div>
      </Section>

      {/* Pastors row */}
      <Section title="Pastors on iWord">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {pastors.map((p, i) => (
            <Link
              key={p.id}
              href={`/pastors/${p.slug}`}
              className="group text-center fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="relative inline-block">
                <div
                  className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-100 blur-md transition-opacity"
                  style={{ background: `radial-gradient(closest-side, hsl(${p.hue},80%,55%), transparent)` }}
                  aria-hidden
                />
                <PastorAvatar
                  imageUrl={p.imageUrl}
                  name={p.name}
                  initials={p.initials}
                  hue={p.hue}
                  className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full text-xl ring-1 ring-line group-hover:ring-gold transition shadow-md shadow-black/10"
                />
              </div>
              <div className="mt-3">
                <div className="text-cream font-medium leading-tight group-hover:text-gold transition-colors">{p.name}</div>
                <div className="text-xs text-cream-muted">{p.church}</div>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Recently added */}
      <Section
        title="Recently added"
        action={<Link href="/sermons" className="text-sm text-cream-muted hover:text-cream">Browse all →</Link>}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recent.map((s, i) => (
            <SermonCard key={s.id} sermon={s} delayMs={i * 70} />
          ))}
        </div>
      </Section>

      {/* CTA strip — newsletter signup (only for signed-out visitors) */}
      {!signedIn && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 my-20">
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-line p-8 sm:p-12 grid md:grid-cols-2 gap-8 items-center bg-gradient-to-br from-ink-3 to-ink-2">
            <div
              aria-hidden
              className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20"
              style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
            />
            <div className="relative">
              <h2 className="font-display text-3xl sm:text-4xl text-cream leading-tight">
                A weekly digest, made for your week.
              </h2>
              <p className="mt-3 text-cream-muted max-w-md">
                Tell us your city and the pastors you love. We&rsquo;ll send a short,
                thoughtful email each Sunday with what to listen to and what&rsquo;s
                happening nearby.
              </p>
            </div>
            <DigestSignup />
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-xs text-cream-faint">
        {allSermons.length} sermons in the library · more on the way.
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-16">
      <div className="flex items-end justify-between mb-6">
        <h2 className="font-display text-2xl sm:text-3xl text-cream">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

