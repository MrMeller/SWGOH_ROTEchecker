import Link from "next/link";
import { PHASES } from "@/lib/data";

/** P1..P6 links. `href` builds the target for a phase number. */
export function PhaseSwitcher({ current, href }: { current: number; href: (phase: number) => string }) {
  return (
    <nav aria-label="Phase" className="grid grid-cols-6 gap-1 rounded-xl bg-slate-900 p-1">
      {PHASES.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === current ? "page" : undefined}
          className={`rounded-lg py-2 text-center text-sm font-semibold transition ${
            p === current ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          P{p}
        </Link>
      ))}
    </nav>
  );
}
