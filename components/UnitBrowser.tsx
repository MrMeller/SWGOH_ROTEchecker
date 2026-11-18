"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DaysVariants } from "@/components/Days";
import { DAYS_OPTIONS, type Days, type Status } from "@/lib/status";
import { filterUnits, unitHref, type SortKey, type StatusFilter, type TypeFilter, type UnitIndexRow, type UsedInFilter } from "@/lib/units";

const PILL: Record<Status, string> = {
  enough: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  days: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
  short: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
};

const PHASES = [1, 2, 3, 4, 5, 6];

function Select<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange((typeof value === "number" ? Number(e.target.value) : e.target.value) as T)}
        className="rounded-lg bg-slate-900 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700 focus:ring-sky-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function UnitList({ rows, days, phase, usedIn }: { rows: UnitIndexRow[]; days: Days; phase: number; usedIn: UsedInFilter }) {
  if (!rows.length) return <p className="rounded-xl bg-slate-900/60 px-4 py-3 text-slate-400 ring-1 ring-slate-800">No unit matches these filters.</p>;
  return (
    <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl bg-slate-900/60 ring-1 ring-slate-800">
      {rows.map((r) => (
        <li key={r.baseId}>
          <Link href={unitHref(r, phase)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/60">
            {r.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image} alt="" loading="lazy" className="size-10 shrink-0 rounded-full bg-slate-800 object-cover" />
            ) : (
              <span className="size-10 shrink-0 rounded-full bg-slate-800" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block truncate text-xs text-slate-500">
                {[r.combatType === 2 ? "Ship" : null, r.alignment, ...r.tags.filter((t) => t !== "Leader")].filter(Boolean).join(", ")}
              </span>
            </span>
            <span className="flex max-w-[45%] flex-wrap justify-end gap-1">
              {r.phases
                .filter((p) => usedIn !== "missions" && (!phase || p.phase === phase))
                .map((p) => (
                  <span
                    key={p.phase}
                    title={`P${p.phase}: ${p.meets} of ${p.need} slots covered at ${r.combatType === 2 ? "7★" : `R${p.minRelic}`}`}
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap ring-1 ring-inset ${PILL[p.status[days]]}`}
                  >
                    P{p.phase} {p.meets}/{p.need}
                  </span>
                ))}
              {r.missions
                .filter((m) => usedIn !== "platoons" && (!phase || m.phase === phase))
                .map((m) => (
                  <span
                    key={m.key}
                    title={`P${m.phase} special mission ${m.planet}: ${m.title}. ${m.named ? "Named in the squad" : "Counts for the squad"}, ${m.meets} members at R${m.minRelic}`}
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-violet-200 ring-1 ring-inset ${
                      m.named ? "bg-violet-500/20 ring-violet-400/60" : "bg-violet-500/5 ring-violet-400/25"
                    }`}
                  >
                    SM{m.phase} {m.meets}
                  </span>
                ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const DEFAULTS = {
  query: "",
  type: "all" as TypeFilter,
  usedIn: "all" as UsedInFilter,
  phase: 0,
  alignment: "",
  tag: "",
  status: "all" as StatusFilter,
  sort: "name" as SortKey,
};

export function UnitBrowser({ rows }: { rows: UnitIndexRow[] }) {
  const [query, setQuery] = useState(DEFAULTS.query);
  const [type, setType] = useState<TypeFilter>(DEFAULTS.type);
  const [usedIn, setUsedIn] = useState<UsedInFilter>(DEFAULTS.usedIn);
  const [phase, setPhase] = useState(DEFAULTS.phase);
  const [alignment, setAlignment] = useState(DEFAULTS.alignment);
  const [tag, setTag] = useState(DEFAULTS.tag);
  const [status, setStatus] = useState<StatusFilter>(DEFAULTS.status);
  const [sort, setSort] = useState<SortKey>(DEFAULTS.sort);

  const current = { query, type, usedIn, phase, alignment, tag, status, sort };
  const changed = (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).some((k) => current[k] !== DEFAULTS[k]);
  const reset = () => {
    setQuery(DEFAULTS.query);
    setType(DEFAULTS.type);
    setUsedIn(DEFAULTS.usedIn);
    setPhase(DEFAULTS.phase);
    setAlignment(DEFAULTS.alignment);
    setTag(DEFAULTS.tag);
    setStatus(DEFAULTS.status);
    setSort(DEFAULTS.sort);
  };

  const tags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].filter((t) => t !== "Leader").sort(), [rows]);
  const alignments = useMemo(() => [...new Set(rows.flatMap((r) => (r.alignment ? [r.alignment] : [])))].sort(), [rows]);

  const variants = Object.fromEntries(
    DAYS_OPTIONS.map((d) => {
      const shown = filterUnits(rows, { query, type, usedIn, phase, alignment, tag, status, days: d }, sort);
      return [
        d,
        <div key={d} className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">
            {shown.length} {shown.length === 1 ? "unit" : "units"}. P pills: players who meet the platoon requirement / slots in that phase, coloured as on
            the overview. <span className="text-violet-300">SM</span> pills: members with the unit at the relic of that phase&apos;s special mission,
            bold when the mission names the unit.
          </p>
          <UnitList rows={shown} days={d} phase={phase} usedIn={usedIn} />
        </div>,
      ];
    }),
  ) as Record<Days, React.ReactNode>;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a name or faction, e.g. Rey or Mandalorian"
        aria-label="Search units"
        className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-base text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-sky-500 focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Select
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { value: "character", label: "Characters" },
            { value: "ship", label: "Ships" },
            { value: "all", label: "Characters and ships" },
          ]}
        />
        <Select
          label="Phase"
          value={phase}
          onChange={setPhase}
          options={[{ value: 0, label: "Any phase" }, ...PHASES.map((p) => ({ value: p, label: `Phase ${p}` }))]}
        />
        <Select
          label="Used in"
          value={usedIn}
          onChange={setUsedIn}
          options={[
            { value: "all", label: "Platoons and missions" },
            { value: "platoons", label: "Platoons" },
            { value: "missions", label: "Special missions" },
          ]}
        />
        <Select
          label="Platoon status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Any status" },
            { value: "notEnough", label: "Not enough on day 1" },
            { value: "short", label: "Short" },
          ]}
        />
        <Select
          label="Alignment"
          value={alignment}
          onChange={setAlignment}
          options={[{ value: "", label: "Any alignment" }, ...alignments.map((a) => ({ value: a, label: a }))]}
        />
        <Select label="Faction" value={tag} onChange={setTag} options={[{ value: "", label: "Any faction" }, ...tags.map((t) => ({ value: t, label: t }))]} />
        <Select
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: "name", label: "Name" },
            { value: "need", label: "Most slots uncovered" },
          ]}
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={reset}
            disabled={!changed}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700 disabled:cursor-default disabled:text-slate-500 disabled:hover:bg-slate-800"
          >
            Reset filters
          </button>
        </div>
      </div>
      <DaysVariants variants={variants} />
    </div>
  );
}
