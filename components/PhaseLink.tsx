"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/** Last phase the visitor looked at, so links back to the overview land on it. */
const KEY = "rote:phase";

export function RememberPhase({ phase }: { phase: number }) {
  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(phase));
    } catch {
      // nothing to remember, links fall back to the first phase
    }
  }, [phase]);
  return null;
}

/**
 * Link to the phase overview: the phase from ?phase= in the current URL, else the
 * remembered one, else phase 1. Renders the fallback first so static HTML stays valid.
 */
export function PhaseLink({ className, children }: { className?: string; children: ReactNode }) {
  const [href, setHref] = useState("/");
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("phase");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      // ignore
    }
    const phase = Number(fromUrl ?? stored);
    if (phase >= 1 && phase <= 6) setHref(`/phase/${phase}`);
  }, []);
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
