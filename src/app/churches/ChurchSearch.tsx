"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function ChurchSearch() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const q = sp.get("q") ?? "";

  const update = (value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (!value) next.delete("q");
    else next.set("q", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="relative w-full sm:max-w-md">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 text-cream-faint pointer-events-none"
        width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        placeholder="Search churches by name, location, denomination..."
        defaultValue={q}
        onBlur={(e) => update(e.currentTarget.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") update(e.currentTarget.value.trim());
        }}
        className="w-full pl-11 pr-4 py-2.5 rounded-full bg-ink-2 ring-1 ring-line text-sm text-cream placeholder:text-cream-faint focus:ring-gold outline-none"
      />
    </div>
  );
}
