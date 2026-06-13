import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

/**
 * Server-rendered. Shows "Sign in" when nobody is logged in, or a small
 * avatar pill + sign-out form when a user has a session.
 *
 * `variant="desktop"` (default) renders the compact navbar pill, hidden on
 * small screens. `variant="mobile"` renders full-width rows for the mobile
 * drawer so signed-in users can always reach their account and sign out.
 */
export async function UserMenu({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (variant === "mobile") {
    if (!user) {
      return (
        <Link
          href="/auth/sign-in"
          className="flex items-center justify-center px-4 py-3 rounded-2xl text-sm font-medium bg-ink-2 text-cream hover:bg-ink-3 transition-colors"
        >
          Sign in
        </Link>
      );
    }

    const email = user.email ?? "";
    const initial = (email[0] ?? "?").toUpperCase();

    return (
      <div className="flex flex-col gap-2">
        <Link
          href="/account"
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-ink-2 hover:bg-ink-3 transition-colors"
          title={email}
        >
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-rose text-ink text-sm font-semibold flex items-center justify-center shrink-0">
            {initial}
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm text-cream">Your account</span>
            <span className="text-xs text-cream-muted truncate">{email}</span>
          </span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center justify-center px-4 py-3 rounded-2xl text-sm text-cream-muted hover:text-cream hover:bg-ink-2 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth/sign-in"
        className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-sm text-cream-muted hover:text-cream"
      >
        Sign in
      </Link>
    );
  }

  const email = user.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <>
      {/* Compact avatar shown on mobile so signed-in state is visible
          without opening the menu. Tapping it opens the account page. */}
      <Link
        href="/account"
        aria-label="Your account"
        title={email}
        className="sm:hidden inline-flex items-center justify-center"
      >
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-rose text-ink text-xs font-semibold flex items-center justify-center">
          {initial}
        </span>
      </Link>

      <div className="hidden sm:flex items-center gap-2">
        <Link
          href="/account"
          className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-ink-3 hover:bg-ink-4 transition-colors"
          title={email}
        >
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-rose text-ink text-xs font-semibold flex items-center justify-center">
            {initial}
          </span>
          <span className="text-xs text-cream-muted max-w-[10rem] truncate">{email}</span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex px-3 py-1.5 rounded-full text-sm text-cream-muted hover:text-cream"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
