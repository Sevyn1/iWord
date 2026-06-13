"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/sermons", label: "Browse" },
  { href: "/pricing", label: "Pricing" },
];

export function Navbar({
  userSlot,
  mobileUserSlot,
  plan = null,
}: {
  userSlot?: React.ReactNode;
  mobileUserSlot?: React.ReactNode;
  /** Current user's plan, or null when signed out. */
  plan?: string | null;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const signedIn = plan !== null;
  const isMember = plan === "devoted" || plan === "patron";

  // Close the mobile menu whenever the route changes.
  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent background scroll while the drawer is open.
  React.useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-ink/85 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center" aria-label="iWord home">
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  active
                    ? "bg-ink-3 text-cream"
                    : "text-cream-muted hover:text-cream hover:bg-ink-2"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 max-w-md mx-auto hidden md:block">
          <SearchStub />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {userSlot ?? (
            <Link
              href="/auth/sign-in"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-sm text-cream-muted hover:text-cream"
            >
              Sign in
            </Link>
          )}
          {isMember ? (
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gold/15 text-gold ring-1 ring-gold/40 hover:bg-gold/25 transition-colors"
              title="You're an iWord+ member"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="m12 3 2.6 5.27 5.82.85-4.21 4.1 1 5.8L12 16.9l-5.2 2.73 1-5.8-4.2-4.1 5.8-.85L12 3Z" />
              </svg>
              iWord+
            </Link>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-gold text-ink hover:bg-gold-hot transition-colors"
            >
              {signedIn ? "Upgrade" : "Subscribe"}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full text-cream-muted hover:text-cream hover:bg-ink-2 transition-colors"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <MobileMenu
          pathname={pathname}
          userSlot={mobileUserSlot}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}

function MobileMenu({
  pathname,
  userSlot,
  onClose,
}: {
  pathname: string;
  userSlot?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="md:hidden fixed inset-0 top-16 z-40">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
      />
      <div className="relative bg-ink border-b border-line px-4 sm:px-6 pt-4 pb-6 flex flex-col gap-4 max-h-[calc(100dvh-4rem)] overflow-y-auto">
        <SearchStub onSubmit={onClose} />

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`px-4 py-3 rounded-2xl text-sm transition-colors ${
                  active
                    ? "bg-ink-3 text-cream"
                    : "text-cream-muted hover:text-cream hover:bg-ink-2"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {userSlot && (
          <div className="pt-2 border-t border-line">{userSlot}</div>
        )}
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SearchStub({ onSubmit }: { onSubmit?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState("");

  // Keep the field in sync with the active query when on the browse page.
  React.useEffect(() => {
    if (pathname === "/sermons") {
      setValue(searchParams.get("q") ?? "");
    }
  }, [pathname, searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/sermons?q=${encodeURIComponent(q)}` : "/sermons");
    onSubmit?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="group flex items-center gap-2 bg-ink-2 hover:bg-ink-3 focus-within:bg-ink-3 transition-colors rounded-full px-3 py-1.5 ring-1 ring-line focus-within:ring-gold"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-cream-muted shrink-0">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search sermons, pastors, scriptures"
        aria-label="Search sermons"
        className="bg-transparent outline-none text-sm text-cream placeholder:text-cream-faint w-full"
      />
    </form>
  );
}
