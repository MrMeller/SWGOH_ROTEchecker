// Phase deployment plan. Platoons only score when all 15 slots are filled, so a planet
// is only worth its full value when all 90 slots are covered. Each player fills a unit
// once per phase, so units compete for players across planets. Pure functions only.
import type { PhaseUnitStatus } from "./status";

/** In-game map order: Dark Side left, Mixed middle, Light Side right. */
export const PLANET_ORDER = ["Dark Side", "Mixed", "Light Side"] as const;

type Unit = Pick<PhaseUnitStatus, "baseId" | "meets" | "planets">;

const req = (u: Unit, alignment: string) => u.planets.find((p) => p.alignment === alignment)?.required ?? 0;
const sumReq = (u: Unit, set: readonly string[]) => set.reduce((a, p) => a + req(u, p), 0);

/** Slots that stay empty when all `set` planets are filled with priority. */
export function missingSlots(units: readonly Unit[], set: readonly string[]): number {
  return units.reduce((a, u) => a + Math.max(0, sumReq(u, set) - u.meets), 0);
}

export interface PlanetSummary {
  alignment: string;
  slots: number;
  /** Slots the plan fills on this planet (focus planets first, leftovers after). */
  filled: number;
  focus: boolean;
}

export interface PhasePlan {
  /** Planets to fill completely, in map order. */
  focus: string[];
  /** True when every focus planet can be filled to 100%. */
  complete: boolean;
  planets: PlanetSummary[];
}

function subsets<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 1; mask < 1 << items.length; mask++) out.push(items.filter((_, i) => mask & (1 << i)));
  return out;
}

export function phasePlan(units: readonly Unit[]): PhasePlan {
  const planets = PLANET_ORDER.filter((p) => units.some((u) => req(u, p) > 0));
  const complete = subsets(planets).filter((s) => missingSlots(units, s) === 0);

  let focus: string[];
  if (complete.length) {
    const size = Math.max(...complete.map((s) => s.length));
    const best = complete.filter((s) => s.length === size);
    // Tie: prefer the set that leaves the other planets closest to full.
    const leftoverFill = (s: string[]) => fill(units, s).reduce((a, p) => a + (s.includes(p.alignment) ? 0 : p.filled), 0);
    focus = best.reduce((a, s) => (leftoverFill(s) > leftoverFill(a) ? s : a));
  } else {
    focus = [planets.reduce((a, p) => (missingSlots(units, [p]) < missingSlots(units, [a]) ? p : a))];
  }

  return {
    focus,
    complete: complete.length > 0,
    planets: fill(units, focus).map((p) => ({ ...p, focus: focus.includes(p.alignment) })),
  };
}

function fill(units: readonly Unit[], focus: readonly string[]): Omit<PlanetSummary, "focus">[] {
  const totals = new Map<string, { slots: number; filled: number }>(PLANET_ORDER.map((p) => [p, { slots: 0, filled: 0 }]));
  for (const u of units) {
    for (const a of allocateUnit(u.planets, u.meets, focus)) {
      const t = totals.get(a.alignment)!;
      t.slots += a.required;
      t.filled += a.placed;
    }
  }
  return PLANET_ORDER.filter((p) => totals.get(p)!.slots > 0).map((p) => ({ alignment: p, ...totals.get(p)! }));
}

export interface UnitAllocation {
  alignment: string;
  required: number;
  placed: number;
  focus: boolean;
}

/** Spread one unit's meeting players: focus planets first, then the rest, in map order. */
export function allocateUnit(
  planets: readonly { alignment: string; required: number }[],
  meets: number,
  focus: readonly string[],
): UnitAllocation[] {
  const order = [...PLANET_ORDER].sort((a, b) => Number(focus.includes(b)) - Number(focus.includes(a)));
  let left = meets;
  const placed = new Map<string, number>();
  for (const p of order) {
    const r = planets.find((x) => x.alignment === p)?.required ?? 0;
    const n = Math.min(r, left);
    placed.set(p, n);
    left -= n;
  }
  return PLANET_ORDER.map((p) => ({
    alignment: p,
    required: planets.find((x) => x.alignment === p)?.required ?? 0,
    placed: placed.get(p)!,
    focus: focus.includes(p),
  }));
}
