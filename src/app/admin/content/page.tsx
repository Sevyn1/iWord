import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { setChurchLogo, setPastorImage } from "./actions";

export const metadata = { title: "Media · Admin" };

type ChurchRow = {
  id: string;
  name: string;
  hue: number;
  initials: string | null;
  logo_url: string | null;
  artwork_url: string | null;
};

type PastorRow = {
  id: string;
  name: string;
  church: string | null;
  hue: number;
  initials: string | null;
  image_url: string | null;
};

export default async function AdminContentPage() {
  await requireAdmin();

  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="font-display text-3xl text-cream">Media</h1>
        <p className="mt-4 text-cream-muted">
          The service-role key isn&apos;t configured, so media management is
          unavailable. Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to enable it.
        </p>
      </div>
    );
  }

  const [{ data: churchData }, { data: pastorData }] = await Promise.all([
    admin
      .from("churches")
      .select("id, name, hue, initials, logo_url, artwork_url")
      .order("name", { ascending: true }),
    admin
      .from("pastors")
      .select("id, name, church, hue, initials, image_url")
      .order("name", { ascending: true }),
  ]);
  const churches = (churchData ?? []) as ChurchRow[];
  const pastors = (pastorData ?? []) as PastorRow[];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold mb-1">Admin</p>
          <h1 className="font-display text-3xl text-cream">Logos &amp; photos</h1>
        </div>
        <Link href="/admin" className="text-sm text-cream-muted hover:text-cream">
          ← Dashboard
        </Link>
      </div>
      <p className="mt-3 text-sm text-cream-muted max-w-2xl">
        Ingestion auto-fills church logos and pastor headshots when it can find
        them. Override any of them here — paste an image URL, or clear the field
        to fall back to the coloured initials placeholder.
      </p>

      {/* Churches */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-cream mb-4">
          Church logos <span className="text-cream-faint text-sm">({churches.length})</span>
        </h2>
        <div className="space-y-3">
          {churches.map((c) => {
            const preview = c.logo_url ?? c.artwork_url;
            return (
              <form
                key={c.id}
                action={setChurchLogo}
                className="flex items-center gap-3 rounded-2xl bg-ink-2 ring-1 ring-line p-3"
              >
                <input type="hidden" name="id" value={c.id} />
                <div
                  className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-sm font-semibold text-white ring-1 ring-line shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${c.hue},65%,38%), hsl(${(c.hue + 30) % 360},70%,22%))`,
                  }}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    c.initials ?? "?"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-cream text-sm font-medium truncate">{c.name}</div>
                  <input
                    type="url"
                    name="logo_url"
                    defaultValue={c.logo_url ?? ""}
                    placeholder="https://…/logo.png (blank = use initials)"
                    className="mt-1 w-full px-3 py-1.5 rounded-lg bg-ink ring-1 ring-line focus:ring-gold outline-none text-xs text-cream placeholder:text-cream-faint"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-ink-4 text-cream text-sm hover:bg-ink-3 whitespace-nowrap shrink-0"
                >
                  Save
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* Pastors */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-cream mb-4">
          Pastor photos <span className="text-cream-faint text-sm">({pastors.length})</span>
        </h2>
        <div className="space-y-3">
          {pastors.map((p) => (
            <form
              key={p.id}
              action={setPastorImage}
              className="flex items-center gap-3 rounded-2xl bg-ink-2 ring-1 ring-line p-3"
            >
              <input type="hidden" name="id" value={p.id} />
              <div
                className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold text-white ring-1 ring-line shrink-0"
                style={{
                  background: `linear-gradient(135deg, hsl(${p.hue},65%,38%), hsl(${(p.hue + 30) % 360},70%,22%))`,
                }}
              >
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  p.initials ?? "?"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-cream text-sm font-medium truncate">
                  {p.name}
                  {p.church && <span className="text-cream-faint"> · {p.church}</span>}
                </div>
                <input
                  type="url"
                  name="image_url"
                  defaultValue={p.image_url ?? ""}
                  placeholder="https://…/headshot.jpg (blank = use initials)"
                  className="mt-1 w-full px-3 py-1.5 rounded-lg bg-ink ring-1 ring-line focus:ring-gold outline-none text-xs text-cream placeholder:text-cream-faint"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-ink-4 text-cream text-sm hover:bg-ink-3 whitespace-nowrap shrink-0"
              >
                Save
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
