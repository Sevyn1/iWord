import Link from "next/link";

/**
 * Shared layout for static legal/policy pages (Terms, Privacy). Renders a
 * consistent header and applies typographic styling to plain child elements
 * (`h2`, `p`, `ul`, etc.) so each page can be written as simple markup.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  /** Human-readable "last updated" date, e.g. "July 3, 2026". */
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-gold mb-3">
          Legal
        </p>
        <h1 className="font-display text-4xl sm:text-5xl text-cream leading-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm text-cream-faint">Last updated {updated}</p>
      </header>

      <article
        className="mt-10 space-y-4 text-cream-muted leading-relaxed
          [&_h2]:font-display [&_h2]:text-cream [&_h2]:text-xl [&_h2]:mt-10 [&_h2]:mb-1
          [&_p]:text-[15px]
          [&_a]:text-gold hover:[&_a]:underline
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-[15px]
          [&_strong]:text-cream [&_strong]:font-medium"
      >
        {children}
      </article>

      <p className="mt-12 pt-6 border-t border-line text-sm text-cream-faint">
        Questions about this page?{" "}
        <Link href="/pricing" className="text-gold hover:underline">
          See our plans
        </Link>{" "}
        or reach us at{" "}
        <a href="mailto:hello@iword.app" className="text-gold hover:underline">
          hello@iword.app
        </a>
        .
      </p>
    </div>
  );
}
