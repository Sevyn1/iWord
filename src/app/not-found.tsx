import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-24 text-center">
      <div className="flex justify-center mb-8">
        <Logo size={40} showWordmark={false} />
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-gold mb-3">Error 404</p>
      <h1 className="font-display text-3xl text-cream">This page wandered off</h1>
      <p className="text-cream-muted mt-3">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
        Let&apos;s get you back to the Word.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot active:scale-95 transition-all"
        >
          Back home
        </Link>
        <Link
          href="/sermons"
          className="px-5 py-2.5 rounded-full bg-ink-4 text-cream font-medium hover:bg-ink-3 active:scale-95 transition-all"
        >
          Browse sermons
        </Link>
      </div>
    </div>
  );
}
