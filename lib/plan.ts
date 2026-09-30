// Phase deployment plan. Platoons only score when all 15 slots are filled, so a planet
// is only worth its full value when all 90 slots are covered. Each player fills a unit
// once per phase, so units compete for players across planets. Planets are identified
// by name (a bonus planet shares its alignment with a regular one). Pure functions only.
import type { Phase } from "./requirements";
import type { PhaseUnitStatus } from "./status";

type Unit = Pick<PhaseUnitStatus, "baseId" | "meets" | "planets">;
type PlanetSlots = readonly { planet: string; required: number }[];

/** Planet names in display order (buildRequirements already sorts planets in map order). */
export function planetOrder(phase: Phase): string[] {
  return phase.planets.map((p) => p.name);
}

const req = (planets: PlanetSlots, planet: string) => planets.find((p) => p.planet === planet)?.required ?? 0;
const sumReq = (u: Unit, set: readonly string[]) => set.reduce((a, p) => a + req(u.planets, p), 0);

/** Slots that stay empty when all `set` planets are filled with priority. */
export function missingSlots(units: readonly Unit[], set: readonly string[]): number {
  return units.reduce((a, u) => a + Math.max(0, sumReq(u, set) - u.meets), 0);
}

export interface PlanetSummary {
  planet: string;
  slots: number;
  /** Slots the plan fills on this planet (focus planets first, leftovers after). */
  filled: number;
  focus: boolean;
}

export interface PhasePlan {
  /** Planets to fill completely, in display order. */
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

export function phasePlan(units: readonly Unit[], order: readonly string[]): PhasePlan {
  const planets = order.filter((p) => units.some((u) => req(u.planets, p) > 0));
  const complete = subsets(planets).filter((s) => missingSlots(units, s) === 0);

  let focus: string[];
  if (complete.length) {
    const size = Math.max(...complete.map((s) => s.length));
    const best = complete.filter((s) => s.length === size);
    // Tie: prefer the set that leaves the other planets closest to full.
    const leftoverFill = (s: string[]) =>
      fill(units, s, order).reduce((a, p) => a + (s.includes(p.planet) ? 0 : p.filled), 0);
    focus = best.reduce((a, s) => (leftoverFill(s) > leftoverFill(a) ? s : a));
  } else {
    focus = [planets.reduce((a, p) => (missingSlots(units, [p]) < missingSlots(units, [a]) ? p : a))];
  }

  return {
    focus,
    complete: complete.length > 0,
    planets: fill(units, focus, order).map((p) => ({ ...p, focus: focus.includes(p.planet) })),
  };
}

function fill(units: readonly Unit[], focus: readonly string[], order: readonly string[]): Omit<PlanetSummary, "focus">[] {
  const totals = new Map(order.map((p) => [p, { slots: 0, filled: 0 }]));
  for (const u of units) {
    for (const a of allocateUnit(u.planets, u.meets, focus, order)) {
      const t = totals.get(a.planet)!;
      t.slots += a.required;
      t.filled += a.placed;
    }
  }
  return order.filter((p) => totals.get(p)!.slots > 0).map((p) => ({ planet: p, ...totals.get(p)! }));
}

export interface UnitAllocation {
  planet: string;
  required: number;
  placed: number;
  focus: boolean;
}

/** Spread one unit's meeting players: focus planets first, then the rest, in display order. */
export function allocateUnit(
  planets: PlanetSlots,
  meets: number,
  focus: readonly string[],
  order: readonly string[],
): UnitAllocation[] {
  const byPriority = [...order].sort((a, b) => Number(focus.includes(b)) - Number(focus.includes(a)));
  let left = meets;
  const placed = new Map<string, number>();
  for (const p of byPriority) {
    const n = Math.min(req(planets, p), left);
    placed.set(p, n);
    left -= n;
  }
  return order.map((p) => ({ planet: p, required: req(planets, p), placed: placed.get(p)!, focus: focus.includes(p) }));
}
