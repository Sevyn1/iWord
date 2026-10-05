/** Validate model output and citations; never invent supporting sources. */
export type ParsedAnswer =
  | { kind: "answered"; answer: string; order: number[] }
  | { kind: "unsupported" }
  | { kind: "invalid" };
export function parseGroundedAnswer(raw: string | null, matchCount: number): ParsedAnswer {
  let body: unknown;
  try { body = JSON.parse(raw ?? ""); } catch { return { kind: "invalid" }; }
  if (!body || typeof body !== "object") return { kind: "invalid" };
  const value = body as { answer?: unknown; supported?: unknown };
  if (typeof value.answer !== "string" || !value.answer.trim() || value.answer.length > 3000 || typeof value.supported !== "boolean") return { kind: "invalid" };
  if (!value.supported) return { kind: "unsupported" };
  const answer = value.answer.trim();
  const order = [...new Set(Array.from(answer.matchAll(/\[(\d+)\]/g), m => Number(m[1])))];
  if (!order.length || order.some(n => n < 1 || n > matchCount)) return { kind: "invalid" };
  const renumber = new Map(order.map((n, i) => [n, i + 1]));
  return { kind: "answered", answer: answer.replace(/\[(\d+)\]/g, (_, d: string) => `[${renumber.get(Number(d))}]`), order };
}
