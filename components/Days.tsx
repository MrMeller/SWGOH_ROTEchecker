"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DAYS_OPTIONS, DEFAULT_DAYS, type Days } from "@/lib/status";

/** Remembered per browser, so every page uses the same number of days. */
const KEY = "rote:days";

/**
 * Shows the variant for the remembered days per phase, with a small control to change it.
 * Pages render every variant on the server and hand them over here, which keeps the site
 * static. The default renders first so the HTML matches, then the stored choice applies.
 */
export function DaysVariants({
  variants,
  control = true,
  className = "",
}: {
  variants: Record<Days, ReactNode>;
  control?: boolean;
  className?: string;
}) {
  const [days, setDays] = useState<Days>(DEFAULT_DAYS);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      if ((DAYS_OPTIONS as readonly number[]).includes(v)) setDays(v as Days);
    } catch {
      // private mode or blocked storage: stay on the default
    }
  }, []);

  const pick = (d: Days) => {
    setDays(d);
    try {
      localStorage.setItem(KEY, String(d));
    } catch {
      // nothing to remember, the page still works
    }
  };

  return (
    <>
      {control && (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 ${className}`}>
          <span>Days we play this phase</span>
          <span role="radiogroup" aria-label="Days per phase" className="inline-flex rounded-lg bg-slate-900 p-0.5 ring-1 ring-slate-800">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={d === days}
                onClick={() => pick(d)}
                className={`rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums transition ${
                  d === days ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {d}
              </button>
            ))}
          </span>
          <span>A player places a unit once per day, so {days === 1 ? "once" : `${days} times`} per phase.</span>
        </div>
      )}
      {variants[days]}
    </>
  );
}
