import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-ink-2/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 text-sm text-cream-muted max-w-sm">
            iWord brings beloved gospel messages from around the world into one
            quiet place. Listen at home, on your commute, or wherever you find a
            spare moment.
          </p>
        </div>
        <div>
          <h4 className="font-display text-cream text-sm uppercase tracking-[0.18em] mb-3">
            Discover
          </h4>
          <ul className="space-y-2 text-sm text-cream-muted">
            <li><Link href="/sermons" className="hover:text-cream">Browse sermons</Link></li>
            <li><Link href="/sermons?sort=trending" className="hover:text-cream">Trending this week</Link></li>
            <li><Link href="/pricing" className="hover:text-cream">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-cream text-sm uppercase tracking-[0.18em] mb-3">
            Company
          </h4>
          <ul className="space-y-2 text-sm text-cream-muted">
            <li><Link href="#" className="hover:text-cream">About iWord</Link></li>
            <li><Link href="#" className="hover:text-cream">For pastors</Link></li>
            <li><Link href="/terms" className="hover:text-cream">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-cream">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 text-xs text-cream-faint flex flex-col sm:flex-row gap-2 justify-between">
          <span>© {new Date().getFullYear()} iWord. Built with reverence.</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-cream">Terms</Link>
            <Link href="/privacy" className="hover:text-cream">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
