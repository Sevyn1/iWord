import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MiniPlayer } from "@/components/MiniPlayer";
import { UserMenu } from "@/components/UserMenu";
import { getCurrentAccount, FREE_MONTHLY_STREAMS } from "@/lib/account";
import { getMonthlyListenedIds } from "@/lib/listens";

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
  title: "iWord — Gospel messages, gathered with care",
  description:
    "Listen to sermons from beloved pastors around the world. Subscribe, follow, and carry the message with you wherever you go.",
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
          <main className="flex-1 pb-24">{children}</main>
          <Footer />
          <MiniPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}

