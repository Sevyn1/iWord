"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/sermons", label: "Browse" },
  { href: "/churches", label: "Churches" },
  { href: "/pricing", label: "Pricing" },
];

/** Nav links shown only to signed-in members. */
const MEMBER_NAV = [{ href: "/following", label: "Following" }];

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

  const navItems = signedIn ? [...NAV, ...MEMBER_NAV] : NAV;

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
          {navItems.map((item) => {
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
          <SearchBox />
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
          navItems={navItems}
          userSlot={mobileUserSlot}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}

function MobileMenu({
  pathname,
  navItems,
  userSlot,
  onClose,
}: {
  pathname: string;
  navItems: { href: string; label: string }[];
  userSlot?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="md:hidden fixed inset-0 top-16 z-40">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative bg-ink border-b border-line px-4 sm:px-6 pt-4 pb-6 flex flex-col gap-4 max-h-[calc(100dvh-4rem)] overflow-y-auto">
        <SearchBox onSubmit={onClose} />

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
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

/** Site search — submits to /sermons?q=, which runs ranked full-text search.
 *  Shows YouTube-style typeahead suggestions (sermons + pastors) while typing. */
function SearchBox({ onSubmit }: { onSubmit?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<{
    sermons: { slug: string; title: string; pastorName: string | null }[];
    pastors: { slug: string; name: string; church: string | null }[];
  }>({ sermons: [], pastors: [] });
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const rootRef = React.useRef<HTMLFormElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Keep the field in sync with the active query when on the browse page.
  React.useEffect(() => {
    if (pathname === "/sermons") {
      setValue(searchParams.get("q") ?? "");
    }
  }, [pathname, searchParams]);

  // Close the dropdown on outside click.
  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Debounced suggestion fetch while typing.
  const fetchSuggestions = React.useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions({ sermons: [], pastors: [] });
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(q.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data);
        setActive(-1);
        setOpen(data.sermons.length > 0 || data.pastors.length > 0);
      } catch {
        // Aborted or offline — keep whatever is showing.
      }
    }, 180);
  }, []);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const goTo = (href: string) => {
    close();
    router.push(href);
    onSubmit?.();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Flat list: sermons first, then pastors (must match render order).
    const flat = [
      ...suggestions.sermons.map((s) => `/sermons/${s.slug}`),
      ...suggestions.pastors.map((p) => `/pastors/${p.slug}`),
    ];
    if (open && active >= 0 && active < flat.length) {
      goTo(flat[active]);
      return;
    }
    const q = value.trim();
    goTo(q ? `/sermons?q=${encodeURIComponent(q)}` : "/sermons");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = suggestions.sermons.length + suggestions.pastors.length;
    if (!open || total === 0) {
      if (e.key === "Escape") close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? total - 1 : a - 1));
    } else if (e.key === "Escape") {
      close();
    }
  };

  const sermonCount = suggestions.sermons.length;

  return (
    <form
      ref={rootRef}
      onSubmit={handleSubmit}
      role="search"
      className="relative"
    >
      <div className="group flex items-center gap-2 bg-ink-2 hover:bg-ink-3 focus-within:bg-ink-3 transition-colors rounded-full px-3 py-1.5 ring-1 ring-line focus-within:ring-gold">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-cream-muted shrink-0">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            fetchSuggestions(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.sermons.length + suggestions.pastors.length > 0) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search sermons, pastors, scriptures"
          aria-label="Search sermons"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          className="bg-transparent outline-none text-sm text-cream placeholder:text-cream-faint w-full"
        />
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-ink-2 ring-1 ring-line shadow-xl shadow-ink/60 overflow-hidden z-50"
        >
          {suggestions.sermons.map((s, i) => (
            <button
              key={`s-${s.slug}`}
              type="button"
              role="option"
              aria-selected={active === i}
              onMouseEnter={() => setActive(i)}
              onClick={() => goTo(`/sermons/${s.slug}`)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                active === i ? "bg-ink-3 text-cream" : "text-cream-muted"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-cream-faint">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
                <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="truncate">{s.title}</span>
              {s.pastorName && (
                <span className="ml-auto shrink-0 text-xs text-cream-faint">
                  {s.pastorName}
                </span>
              )}
            </button>
          ))}
          {suggestions.pastors.map((p, i) => (
            <button
              key={`p-${p.slug}`}
              type="button"
              role="option"
              aria-selected={active === sermonCount + i}
              onMouseEnter={() => setActive(sermonCount + i)}
              onClick={() => goTo(`/pastors/${p.slug}`)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                active === sermonCount + i
                  ? "bg-ink-3 text-cream"
                  : "text-cream-muted"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-cream-faint">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="truncate">{p.name}</span>
              {p.church && (
                <span className="ml-auto shrink-0 text-xs text-cream-faint truncate max-w-[10rem]">
                  {p.church}
                </span>
              )}
            </button>
          ))}
          {value.trim() && (
            <button
              type="submit"
              className="w-full px-3.5 py-2.5 text-left text-xs text-gold hover:bg-ink-3 transition-colors border-t border-line"
            >
              See all results for &ldquo;{value.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </form>
  );
}
