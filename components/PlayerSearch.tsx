"use client";

import Link from "next/link";
import { useState } from "react";

export function PlayerSearch({ players }: { players: { allyCode: number; name: string; stale?: boolean }[] }) {
  const [q, setQ] = useState("");
  const shown = players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your name"
        aria-label="Search players"
        className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-base text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-sky-500 focus:outline-none"
      />
      <ul className="mt-3 divide-y divide-slate-800 rounded-xl bg-slate-900/60 ring-1 ring-slate-800">
        {shown.map((p) => (
          <li key={p.allyCode}>
            <Link href={`/player/${p.allyCode}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/60">
              <span>{p.name}</span>
              {p.stale && <span className="text-xs text-amber-300">old data</span>}
            </Link>
          </li>
        ))}
        {!shown.length && <li className="px-4 py-3 text-slate-400">No player matches “{q}”.</li>}
      </ul>
    </div>
  );
}
