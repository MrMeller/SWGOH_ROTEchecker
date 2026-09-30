"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Client-side tabs over panels rendered on the server. The initial tab can come from
 * a query parameter (e.g. ?phase=3) so links from other pages land on the right one.
 */
export function Tabs({
  tabs,
  queryParam,
}: {
  tabs: { key: string; label: ReactNode; panel: ReactNode }[];
  queryParam?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.key);

  useEffect(() => {
    if (!queryParam) return;
    const wanted = new URLSearchParams(window.location.search).get(queryParam);
    if (wanted && tabs.some((t) => t.key === wanted)) setActive(wanted);
  }, [queryParam, tabs]);

  const select = (key: string) => {
    setActive(key);
    if (queryParam) {
      const url = new URL(window.location.href);
      url.searchParams.set(queryParam, key);
      window.history.replaceState(null, "", url);
    }
  };

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-slate-900 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === active}
            onClick={() => select(t.key)}
            className={`min-w-12 flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
              t.key === active ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={t.key !== active} className="mt-4">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
