"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Remembered per browser, so the filter survives opening a unit and coming back. */
const STORAGE_KEY = "rote:onlyShort";

/** Wraps server-rendered rows; rows marked data-status="enough" hide when the filter is on. */
export function ShortFilter({ children }: { children: ReactNode }) {
  const [onlyShort, setOnlyShort] = useState(false);

  useEffect(() => {
    try {
      setOnlyShort(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Private mode or blocked storage: the filter just starts unchecked.
    }
  }, []);

  const toggle = (checked: boolean) => {
    setOnlyShort(checked);
    try {
      localStorage.setItem(STORAGE_KEY, checked ? "1" : "0");
    } catch {
      // Same as above: nothing to remember, the page still works.
    }
  };

  return (
    <div data-only-short={onlyShort} className="group/filter">
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={onlyShort}
          onChange={(e) => toggle(e.target.checked)}
          className="size-4 accent-sky-500"
        />
        Show only units we are short on
      </label>
      {children}
    </div>
  );
}
