import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RotE Platoon Tracker",
  description: "DutchJedi Rise of the Empire platoon unit overview",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
