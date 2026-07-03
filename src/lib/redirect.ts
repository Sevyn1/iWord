/**
 * Sanitize a user-supplied `next` redirect target. Only same-site absolute
 * paths are allowed — anything else (external URLs, protocol-relative links,
 * backslash tricks) falls back to the home page to prevent open redirects.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  // Reject protocol-relative ("//evil.com") and backslash ("/\evil.com") tricks.
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
