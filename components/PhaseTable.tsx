"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Alignment } from "@/lib/requirements";
import type { Status } from "@/lib/status";
import { PLANET_STYLE } from "./planets";

/** Remembered per browser, so the filter survives opening a unit and coming back. */
const STORAGE_KEY = "rote:onlyShort";

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
  /** Players meeting the unit that no planned platoon uses. */
  spare: number;
  /** One cell per planet, in the phase's planet order. */
  cells: TableCell[];
}

const STATUS_ORDER: Record<Status, number> = { short: 0, planet: 1, enough: 2 };
const STATUS_EDGE: Record<Status, string> = { short: "border-rose-400", planet: "border-amber-300", enough: "border-emerald-400" };
const STATUS_TEXT: Record<Status, string> = { short: "text-rose-300", planet: "text-amber-200", enough: "text-emerald-300" };

/** Status first (short, planet only, enough), then the biggest requirement. */
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

export function PhaseTable({ phase, planets, rows }: { phase: number; planets: TablePlanet[]; rows: TableRow[] }) {
  const [onlyShort, setOnlyShort] = useState(false);
  const [sortPlanet, setSortPlanet] = useState<number | null>(null);

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
      // Nothing to remember, the page still works.
    }
  };

  const shown = useMemo(() => {
    const list = onlyShort ? rows.filter((r) => r.status !== "enough") : rows;
    return [...list].sort(sortPlanet === null ? byStatus : byPlanet(sortPlanet));
  }, [rows, onlyShort, sortPlanet]);

  const cols = planets.length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-slate-300">
          <input type="checkbox" checked={onlyShort} onChange={(e) => toggle(e.target.checked)} className="size-4 accent-sky-500" />
          Show only units we are short on
        </label>
        <span className="text-xs text-slate-500">
          {sortPlanet === null ? "Sorted: short first. Tap a planet to sort by it." : (
            <>
              Sorted by {planets[sortPlanet].name}.{" "}
              <button onClick={() => setSortPlanet(null)} className="text-sky-400 hover:underline">
                Reset
              </button>
            </>
          )}
        </span>
      </div>

      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col />
          {planets.map((p) => (
            <col key={p.name} className="w-10" />
          ))}
          <col className="w-16" />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-700 text-[11px] text-slate-400">
            <th className="py-1.5 pl-2 text-left font-medium">Unit</th>
            {planets.map((p, i) => (
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
              {r.cells.map((c, i) => (
                <td key={i} className="py-1.5 text-right align-top tabular-nums">
                  <Cell cell={c} />
                </td>
              ))}
              <td className={`py-1.5 pr-1 text-right align-top text-[13px] font-semibold tabular-nums ${STATUS_TEXT[r.status]}`}>
                {r.meets} / {r.need}
                {r.spare > 0 && <span className="block text-[10px] font-normal text-slate-500">+{r.spare} spare</span>}
              </td>
            </tr>
          ))}
          {!shown.length && (
            <tr>
              <td colSpan={cols + 2} className="py-6 text-center text-slate-500">
                Every unit in this phase is covered.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>Cells: players the plan places / slots on that planet.</span>
        <span><span className="rounded bg-emerald-500/15 px-1 text-emerald-300">5/5</span> covered</span>
        <span><span className="rounded bg-rose-500/15 px-1 text-rose-300">0/7</span> we lack players here</span>
        <span><span className="text-slate-400">1/5</span> players used elsewhere</span>
        <span>· not needed</span>
        {planets.some((p) => p.bonus) && <span>* bonus planet</span>}
      </div>
    </div>
  );
}
