import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MiniPlayer } from "@/components/MiniPlayer";
import { BillingAlert } from "@/components/BillingAlert";
import { UserMenu } from "@/components/UserMenu";
import { AskWidget } from "@/components/AskWidget";
import { getCurrentAccount, isPaidPlan, FREE_MONTHLY_STREAMS } from "@/lib/account";
import { getMonthlyListenedIds } from "@/lib/listens";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const account = await getCurrentAccount();
  const monthlyListenedIds = account ? await getMonthlyListenedIds() : [];
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-cream">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <PlayerProvider
          plan={account?.plan ?? null}
          monthlyListenedIds={monthlyListenedIds}
          freeMonthlyLimit={FREE_MONTHLY_STREAMS}
        >
          <Navbar
            userSlot={<UserMenu />}
            mobileUserSlot={<UserMenu variant="mobile" />}
            plan={account?.plan ?? null}
          />
          {account?.pastDue && <BillingAlert plan={account.plan} />}
          <main id="main-content" className="flex-1 pb-24">{children}</main>
          <Footer />
          <MiniPlayer />
          <AskWidget canAsk={isPaidPlan(account?.plan)} />
        </PlayerProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

