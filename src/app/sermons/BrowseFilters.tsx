"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Pastor } from "@/lib/types";

type Props = {
  pastors: Pastor[];
  topics: string[];
};

export function BrowseFilters({ pastors, topics }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const update = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(sp.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  };

  const sort = sp.get("sort") ?? "recent";
  const pastor = sp.get("pastor") ?? "";
  const topic = sp.get("topic") ?? "";
  const q = sp.get("q") ?? "";

  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input
        type="search"
        placeholder="Search title, scripture, pastor..."
        defaultValue={q}
        onChange={(e) => {
          const v = e.currentTarget.value;
          // Debounced enough for a demo: update on blur or Enter
          if (e.nativeEvent instanceof InputEvent === false) {
            update("q", v || undefined);
          }
        }}
        onBlur={(e) => update("q", e.currentTarget.value || undefined)}
        onKeyDown={(e) => {
          if (e.key === "Enter") update("q", e.currentTarget.value || undefined);
        }}
        className="px-4 py-2.5 rounded-full bg-ink-2 ring-1 ring-line text-sm text-cream placeholder:text-cream-faint focus:ring-gold outline-none"
      />
      <Select
        label="Pastor"
        value={pastor}
        onChange={(v) => update("pastor", v || undefined)}
        options={[{ value: "", label: "All pastors" }, ...pastors.map((p) => ({ value: p.id, label: p.name }))]}
      />
      <Select
        label="Topic"
        value={topic}
        onChange={(v) => update("topic", v || undefined)}
        options={[{ value: "", label: "All topics" }, ...topics.map((t) => ({ value: t, label: t }))]}
      />
      <Select
        label="Sort"
        value={sort}
        onChange={(v) => update("sort", v === "recent" ? undefined : v)}
        options={[
          { value: "recent", label: "Most recent" },
          { value: "trending", label: "Trending this week" },
          { value: "longest", label: "Longest first" },
          { value: "shortest", label: "Shortest first" },
        ]}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full px-4 py-2.5 pr-9 rounded-full bg-ink-2 ring-1 ring-line text-sm text-cream focus:ring-gold outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cream-muted"
        width="14" height="14" viewBox="0 0 24 24" fill="none"
      >
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
