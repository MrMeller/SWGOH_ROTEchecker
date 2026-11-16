// The unit index behind the Characters page: every unit with a page (platoon units and the characters a
// special mission counts), with its guild status per phase, and the search and filters over it.
// Pure functions; the page builds the rows from lib/data.ts.
import type { Days, Status } from "./status";

export interface UnitIndexPhase {
  phase: number;
  minRelic: number;
  /** Phase total: slots for the unit across all platoons of the phase. */
  need: number;
  meets: number;
  /** Status per days played, as on the overview. */
  status: Record<Days, Status>;
}

export interface UnitIndexMission {
  phase: number;
  planet: string;
  title: string;
  /** Tab key on the unit page. */
  key: string;
  minRelic: number;
  /** The mission names this unit; otherwise it counts as one of the squad's tag. */
  named: boolean;
  /** Members with the unit at the mission relic or higher. */
  meets: number;
}

export interface UnitIndexRow {
  baseId: string;
  name: string;
  combatType: 1 | 2;
  image?: string;
  alignment?: string;
  /** Faction and role tags from the swgoh.gg catalog. */
  tags: string[];
  /** Phases whose platoons need the unit, in phase order. Empty for a unit only missions use. */
  phases: UnitIndexPhase[];
  /** Special missions the unit counts for, in mission order. */
  missions: UnitIndexMission[];
}

export type TypeFilter = "all" | "character" | "ship";
export type UsedInFilter = "all" | "platoons" | "missions";
export type StatusFilter = "all" | "short" | "notEnough";
export type SortKey = "name" | "need";

export interface UnitFilter {
  query: string;
  type: TypeFilter;
  usedIn: UsedInFilter;
  /** 0 = any phase. */
  phase: number;
  alignment: string; // "" = any
  tag: string; // "" = any
  /** Platoon status; a unit only missions use never matches "short" or "notEnough". */
  status: StatusFilter;
  days: Days;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Platoon phases the filter looks at: the chosen one, or every phase the unit is in. */
export function phasesInScope(row: UnitIndexRow, phase: number): UnitIndexPhase[] {
  return phase ? row.phases.filter((p) => p.phase === phase) : row.phases;
}

/** Special missions the filter looks at: those of the chosen phase, or all of them. */
export function missionsInScope(row: UnitIndexRow, phase: number): UnitIndexMission[] {
  return phase ? row.missions.filter((m) => m.phase === phase) : row.missions;
}

/** Every search word must appear in the name, the base_id or one of the tags. */
export function matchesQuery(row: UnitIndexRow, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm([row.name, row.baseId, ...row.tags].join(" "));
  return words.every((w) => hay.includes(w));
}

export function matchesFilter(row: UnitIndexRow, f: UnitFilter): boolean {
  if (f.type === "character" && row.combatType !== 1) return false;
  if (f.type === "ship" && row.combatType !== 2) return false;
  if (f.alignment && row.alignment !== f.alignment) return false;
  if (f.tag && !row.tags.includes(f.tag)) return false;
  const phases = f.usedIn === "missions" ? [] : phasesInScope(row, f.phase);
  const missions = f.usedIn === "platoons" ? [] : missionsInScope(row, f.phase);
  if (!phases.length && !missions.length) return false;
  if (f.status === "short" && !phases.some((p) => p.status[f.days] === "short")) return false;
  if (f.status === "notEnough" && !phases.some((p) => p.status[f.days] !== "enough")) return false;
  return matchesQuery(row, f.query);
}

/** Platoon slots still uncovered in scope: how far the guild is from filling the unit on day 1. */
export function shortfall(row: UnitIndexRow, phase: number): number {
  return phasesInScope(row, phase).reduce((n, p) => n + Math.max(0, p.need - p.meets), 0);
}

export function filterUnits(rows: readonly UnitIndexRow[], f: UnitFilter, sort: SortKey = "name"): UnitIndexRow[] {
  const shown = rows.filter((r) => matchesFilter(r, f));
  const byName = (a: UnitIndexRow, b: UnitIndexRow) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  return shown.sort(sort === "need" ? (a, b) => shortfall(b, f.phase) - shortfall(a, f.phase) || byName(a, b) : byName);
}

/** Unit page link that opens the tab for the phase in scope: its platoon phase first, else its mission there. */
export function unitHref(row: UnitIndexRow, phase: number): string {
  const base = `/unit/${row.baseId}`;
  if (!phase) return base;
  if (row.phases.some((p) => p.phase === phase)) return `${base}?phase=${phase}`;
  const m = row.missions.find((x) => x.phase === phase);
  return m ? `${base}?phase=${m.key}` : base;
}
