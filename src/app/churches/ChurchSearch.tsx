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
    <input
      type="search"
      placeholder="Search churches by name, location, denomination..."
      defaultValue={q}
      onBlur={(e) => update(e.currentTarget.value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") update(e.currentTarget.value.trim());
      }}
      className="w-full sm:max-w-md px-4 py-2.5 rounded-full bg-ink-2 ring-1 ring-line text-sm text-cream placeholder:text-cream-faint focus:ring-gold outline-none"
    />
  );
}
