"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Alignment } from "@/lib/requirements";
import type { Status } from "@/lib/status";
import { PLANET_STYLE } from "./planets";

/** Remembered per browser, so the toggles survive opening a unit and coming back. */
const KEYS = { onlyShort: "rote:onlyShort", planets: "rote:planets" } as const;

function remember(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback; // private mode or blocked storage
  }
}

function store(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // nothing to remember, the page still works
  }
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-slate-300"
    >
      <span className={`relative inline-block h-5 w-9 rounded-full transition ${checked ? "bg-sky-500" : "bg-slate-700"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${checked ? "left-4.5" : "left-0.5"}`} />
      </span>
      {children}
    </button>
  );
}

export interface TablePlanet {
  name: string;
  alignment: Alignment;
  bonus: boolean;
  /** Header label, 2 or 3 letters. */
  code: string;
  href: string;
}

export interface TableCell {
  required: number;
  /** Slots the phase plan fills with this unit on this planet. */
  planned: number;
  /** Open platoons here the unit has no spare player for. */
  shortFor: number;
}

export interface TableRow {
  baseId: string;
  name: string;
  ship: boolean;
  status: Status;
  meets: number;
  need: number;
  /** Placements (players × days) the planned platoons leave unused. */
  spare: number;
  /** One cell per planet, in the phase's planet order. */
  cells: TableCell[];
}

const STATUS_ORDER: Record<Status, number> = { short: 0, days: 1, enough: 2 };
const STATUS_EDGE: Record<Status, string> = { short: "border-rose-400", days: "border-amber-300", enough: "border-emerald-400" };
const STATUS_TEXT: Record<Status, string> = { short: "text-rose-300", days: "text-amber-200", enough: "text-emerald-300" };

/** Status first (short, over days, enough), then the biggest requirement. */
const byStatus = (a: TableRow, b: TableRow) =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.need - a.need || a.name.localeCompare(b.name);

/** Units needed on this planet first, gaps before covered ones, then by requirement. */
const byPlanet = (i: number) => (a: TableRow, b: TableRow) => {
  const x = a.cells[i];
  const y = b.cells[i];
  return (
    Number(y.required > 0) - Number(x.required > 0) ||
    y.shortFor - x.shortFor ||
    y.required - y.planned - (x.required - x.planned) ||
    y.required - x.required ||
    a.name.localeCompare(b.name)
  );
};

function Cell({ cell }: { cell: TableCell }) {
  if (!cell.required) return <span className="text-slate-700">·</span>;
  const text = `${cell.planned}/${cell.required}`;
  if (cell.shortFor > 0) return <span className="rounded bg-rose-500/15 px-1 text-rose-300">{text}</span>;
  if (cell.planned >= cell.required) return <span className="rounded bg-emerald-500/15 px-1 text-emerald-300">{text}</span>;
  return <span className="text-slate-400">{text}</span>;
}

export function PhaseTable({ phase, days, planets, rows }: { phase: number; days: number; planets: TablePlanet[]; rows: TableRow[] }) {
  const [onlyShort, setOnlyShort] = useState(false);
  const [showPlanets, setShowPlanets] = useState(false);
  const [sortPlanet, setSortPlanet] = useState<number | null>(null);

  useEffect(() => {
    setOnlyShort(remember(KEYS.onlyShort, false));
    setShowPlanets(remember(KEYS.planets, false));
  }, []);

  const toggleShort = (v: boolean) => {
    setOnlyShort(v);
    store(KEYS.onlyShort, v);
  };

  const togglePlanets = (v: boolean) => {
    setShowPlanets(v);
    store(KEYS.planets, v);
    if (!v) setSortPlanet(null); // nothing to sort by when the planet columns are hidden
  };

  const shown = useMemo(() => {
    const list = onlyShort ? rows.filter((r) => r.status !== "enough") : rows;
    return [...list].sort(sortPlanet === null ? byStatus : byPlanet(sortPlanet));
  }, [rows, onlyShort, sortPlanet]);

  const cols = planets.length;

  return (
    <div>
      <div className="mb-3 space-y-2">
        <Toggle checked={onlyShort} onChange={toggleShort}>Show only units we are short on</Toggle>
        <Toggle checked={showPlanets} onChange={togglePlanets}>Show planet distribution</Toggle>
        <p className="text-xs text-slate-500">
          {sortPlanet === null ? (
            showPlanets ? "Sorted short first. Tap a planet to sort by it." : "Sorted short first."
          ) : (
            <>
              Sorted by {planets[sortPlanet].name}.{" "}
              <button onClick={() => setSortPlanet(null)} className="text-sky-400 hover:underline">
                Reset
              </button>
            </>
          )}
        </p>
      </div>

      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col />
          {showPlanets && planets.map((p) => <col key={p.name} className="w-10" />)}
          <col className="w-16" />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-700 text-[11px] text-slate-400">
            <th className="py-1.5 pl-2 text-left font-medium">Unit</th>
            {showPlanets && planets.map((p, i) => (
              <th key={p.name} className="py-1.5 text-right font-medium">
                <button
                  onClick={() => setSortPlanet(sortPlanet === i ? null : i)}
                  title={`${p.name}: tap to sort by this planet`}
                  aria-pressed={sortPlanet === i}
                  className={`rounded px-1 ${PLANET_STYLE[p.alignment].text} ${sortPlanet === i ? "bg-slate-800 underline" : "hover:bg-slate-800"}`}
                >
                  {p.code}
                  {p.bonus && <span className="text-slate-500">*</span>}
                </button>
              </th>
            ))}
            <th className="py-1.5 pr-1 text-right font-medium">have / need</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.baseId} className={`border-b border-slate-800 border-l-[3px] ${STATUS_EDGE[r.status]}`}>
              <td className="py-1.5 pr-1 pl-2 align-top">
                <Link href={`/unit/${r.baseId}?phase=${phase}`} className="text-[13px] leading-snug hover:underline">
                  {r.name}
                  {r.ship && <span className="ml-1 text-[10px] text-slate-500">ship</span>}
                </Link>
              </td>
              {showPlanets && r.cells.map((c, i) => (
                <td key={i} className="py-1.5 text-right align-top tabular-nums">
                  <Cell cell={c} />
                </td>
              ))}
              <td className={`py-1.5 pr-1 text-right align-top text-[13px] font-semibold tabular-nums ${STATUS_TEXT[r.status]}`}>
                {r.meets} / {r.need}
                {r.status !== "enough" && r.spare > 0 && (
                  <span className="block text-[10px] font-normal text-slate-500">
                    +{r.spare} spare {days > 1 ? "placement" : "player"}{r.spare === 1 ? "" : "s"}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {!shown.length && (
            <tr>
              <td colSpan={(showPlanets ? cols : 0) + 2} className="py-6 text-center text-slate-500">
                Every unit in this phase is covered.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showPlanets && (
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>Cells: players the plan places / slots on that planet.</span>
        <span><span className="rounded bg-emerald-500/15 px-1 text-emerald-300">5/5</span> covered</span>
        <span><span className="rounded bg-rose-500/15 px-1 text-rose-300">0/7</span> we lack players here</span>
        <span><span className="text-slate-400">1/5</span> players used elsewhere</span>
        <span>· not needed</span>
        {planets.some((p) => p.bonus) && <span>* bonus planet</span>}
      </div>
      )}
    </div>
  );
}
