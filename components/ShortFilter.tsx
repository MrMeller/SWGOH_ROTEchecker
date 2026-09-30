"use client";

import { useState, type ReactNode } from "react";

/** Wraps server-rendered rows; rows marked data-status="enough" hide when the filter is on. */
export function ShortFilter({ children }: { children: ReactNode }) {
  const [onlyShort, setOnlyShort] = useState(false);
  return (
    <div data-only-short={onlyShort} className="group/filter">
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={onlyShort}
          onChange={(e) => setOnlyShort(e.target.checked)}
          className="size-4 accent-sky-500"
        />
        Show only units we are short on
      </label>
      {children}
    </div>
  );
}
