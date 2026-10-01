import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getSnapshot } from "@/lib/data";
import { formatDate } from "@/lib/format";
import "./globals.css";

export const metadata: Metadata = {
  title: "RotE Platoon Tracker",
  description: "DutchJedi Rise of the Empire platoon unit overview",
};

export const viewport: Viewport = { themeColor: "#020617" };

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/phase/1/focus", label: "Focus" },
  { href: "/player", label: "Players" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const snapshot = getSnapshot();
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              RotE Tracker <span className="text-slate-500">DutchJedi</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          {snapshot.demo && (
            <div className="bg-amber-400/15 px-4 py-1.5 text-center text-xs text-amber-200">
              Demo data: MrMeller&apos;s real roster plus 40 generated demo players. Live guild data comes with the sync.
            </div>
          )}
        </header>
        <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 pb-8 text-xs text-slate-500">
          {snapshot.memberCount} members, data from {formatDate(snapshot.syncedAt)}. Roster data from{" "}
          <a href="https://swgoh.gg" className="underline hover:text-slate-300">swgoh.gg</a>.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
