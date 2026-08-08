import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/content";

/**
 * Navbar typeahead. GET /api/search/suggest?q=… → top-ranked sermon + pastor
 * suggestions (same ranking as the results page). Public content only (anon
 * client + RLS), briefly CDN-cached per query to absorb keystroke traffic.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 80);

  const suggestions = await getSearchSuggestions(q);

  return NextResponse.json(suggestions, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
