import Link from "next/link";
import { Logo } from "@/components/Logo";
import { signIn } from "@/app/auth/actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <div className="text-center mb-8">
        <Logo size={36} />
      </div>
      <div className="rounded-2xl bg-ink-2 ring-1 ring-line p-7">
        <h1 className="font-display text-2xl text-cream">Welcome back</h1>
        <p className="text-cream-muted text-sm mt-1">
          Sign in to pick up where you left off.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-rose/15 ring-1 ring-rose/40 px-3 py-2 text-sm text-rose">
            {error}
          </div>
        )}

        <form action={signIn} className="mt-6 space-y-4">
          <Field label="Email" type="email" name="email" placeholder="you@example.com" required />
          <Field label="Password" type="password" name="password" placeholder="••••••••" required />
          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-full bg-gold text-ink font-medium hover:bg-gold-hot active:scale-95 transition-all"
          >
            Sign in
          </button>
        </form>
        <p className="mt-6 text-sm text-cream-muted text-center">
          New here?{" "}
          <Link href="/auth/sign-up" className="text-gold hover:text-gold-hot">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.15em] text-cream-faint mb-1.5">{label}</span>
      <input
        {...rest}
        className="w-full px-4 py-2.5 rounded-full bg-ink ring-1 ring-line focus:ring-gold outline-none text-cream placeholder:text-cream-faint"
      />
    </label>
  );
}
