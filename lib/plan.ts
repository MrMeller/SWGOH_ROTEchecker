// Platoon plan for a phase. A platoon only scores when all 15 slots are filled, and each
// player fills a unit once per phase, so platoons compete for the same players across all
// planets. The plan is the largest set of platoons that can be filled at the same time.
// Pure functions only.
import type { Phase } from "./requirements";

/** Units needed per platoon: base_id -> slots. */
type Demand = Map<string, number>;

interface PlatoonRef {
  planet: string;
  index: number;
  bonus: boolean;
  demand: Demand;
}

export interface PlanetPlan {
  planet: string;
  /** One entry per platoon, in board order: true when the plan fills it. */
  platoons: boolean[];
  filled: number;
}

export interface PhasePlan {
  planets: PlanetPlan[];
  filled: number;
  total: number;
  /** False when the search hit its node limit and the result may not be the maximum. */
  exact: boolean;
  /** Slots each unit fills in the planned platoons, per planet: base_id -> planet -> slots. */
  planned: Map<string, Map<string, number>>;
}

const demandOf = (platoon: readonly string[]): Demand => {
  const d = new Map<string, number>();
  for (const id of platoon) d.set(id, (d.get(id) ?? 0) + 1);
  return d;
};

const fits = (d: Demand, supply: ReadonlyMap<string, number>) => [...d].every(([id, n]) => (supply.get(id) ?? 0) >= n);

/** Default search budget: plenty for 18 to 24 platoons, and keeps builds fast in the worst case. */
const NODE_LIMIT = 2_000_000;

/**
 * Largest set of platoons whose combined demand fits the supply (players meeting each unit).
 * Exact branch and bound. Ties go to the first set found in `candidates` order, so callers
 * put the platoons they prefer first.
 */
export function maxPlatoons(
  candidates: readonly Demand[],
  supply: ReadonlyMap<string, number>,
  nodeLimit = NODE_LIMIT,
): { chosen: number[]; exact: boolean } {
  const usable = candidates.map((d, i) => ({ d, i })).filter((c) => fits(c.d, supply));
  const left = new Map(supply);
  const take = (d: Demand, sign: 1 | -1) => {
    for (const [id, n] of d) left.set(id, (left.get(id) ?? 0) - sign * n);
  };

  // Greedy start: often optimal, and gives the search a good bound.
  let best: number[] = [];
  for (const c of usable) {
    if (fits(c.d, left)) {
      take(c.d, 1);
      best.push(c.i);
    }
  }
  for (const i of best) take(candidates[i], -1);
  if (best.length === usable.length) return { chosen: best, exact: true };

  let nodes = 0;
  let exact = true;
  const chosen: number[] = [];
  const search = (k: number) => {
    if (++nodes > nodeLimit) {
      exact = false;
      return;
    }
    if (chosen.length + (usable.length - k) <= best.length) return;
    if (k === usable.length) {
      best = [...chosen];
      return;
    }
    const c = usable[k];
    if (fits(c.d, left)) {
      take(c.d, 1);
      chosen.push(c.i);
      search(k + 1);
      chosen.pop();
      take(c.d, -1);
    }
    if (exact) search(k + 1);
  };
  search(0);
  return { chosen: best.sort((a, b) => a - b), exact };
}

export function phasePlan(phase: Phase, meets: ReadonlyMap<string, number>): PhasePlan {
  const refs: PlatoonRef[] = phase.planets.flatMap((pl) =>
    pl.platoons.map((platoon, index) => ({ planet: pl.name, index, bonus: pl.bonus, demand: demandOf(platoon) })),
  );
  // Prefer regular planets (bonus planets need unlocking), then platoons that need fewer
  // scarce units, so ties land on the easiest platoons.
  const pressure = (r: PlatoonRef) => [...r.demand].reduce((a, [id, n]) => a + n / Math.max(1, meets.get(id) ?? 0), 0);
  const order = refs
    .map((r, i) => ({ r, i, p: pressure(r) }))
    .sort((a, b) => Number(a.r.bonus) - Number(b.r.bonus) || a.p - b.p || a.i - b.i);

  const { chosen, exact } = maxPlatoons(order.map((o) => o.r.demand), meets);
  const filled = new Set(chosen.map((k) => order[k].i));

  const planned = new Map<string, Map<string, number>>();
  const planets = phase.planets.map((pl) => ({ planet: pl.name, platoons: pl.platoons.map(() => false), filled: 0 }));
  refs.forEach((r, i) => {
    if (!filled.has(i)) return;
    const p = planets.find((x) => x.planet === r.planet)!;
    p.platoons[r.index] = true;
    p.filled++;
    for (const [id, n] of r.demand) {
      const perPlanet = planned.get(id) ?? new Map<string, number>();
      perPlanet.set(r.planet, (perPlanet.get(r.planet) ?? 0) + n);
      planned.set(id, perPlanet);
    }
  });

  return { planets, filled: filled.size, total: refs.length, exact, planned };
}

export interface UnitAllocation {
  planet: string;
  /** Slots for this unit on the planet, across all six platoons. */
  required: number;
  /** Slots it fills in the planned platoons. */
  planned: number;
  /** Per platoon: undefined when the unit is not in it, else whether the plan fills it. */
  platoons: (boolean | undefined)[];
  /** Open platoons on this planet this unit is short for, after the planned ones. */
  shortFor: number;
}

/** Where one unit's players go under the phase plan, per planet in display order. */
export function unitAllocation(phase: Phase, plan: PhasePlan, baseId: string, meets: number): UnitAllocation[] {
  const planned = plan.planned.get(baseId);
  const spare = meets - [...(planned?.values() ?? [])].reduce((a, n) => a + n, 0);
  return phase.planets.map((pl) => {
    const state = plan.planets.find((p) => p.planet === pl.name)!.platoons;
    let required = 0;
    let shortFor = 0;
    const platoons = pl.platoons.map((platoon, i) => {
      const n = platoon.filter((id) => id === baseId).length;
      if (!n) return undefined;
      required += n;
      if (!state[i] && spare < n) shortFor++;
      return state[i];
    });
    return { planet: pl.name, required, planned: planned?.get(pl.name) ?? 0, platoons, shortFor };
  });
}

export type SlotState = "filled" | "lacking" | "held";

export interface PlatoonView {
  /** 1-based, as numbered on the in-game board. */
  number: number;
  filled: boolean;
  slots: { baseId: string; state: SlotState }[];
  /** Distinct units this platoon lacks, with how many slots each: base_id -> slots. */
  lacking: Map<string, number>;
}

/**
 * The six platoons of one planet with a state per slot: "filled" when the plan fills the
 * platoon, otherwise "lacking" when the unit has no spare player left for this platoon
 * (so gearing it is needed to open the platoon) or "held" when only other units hold it back.
 */
export function platoonViews(phase: Phase, plan: PhasePlan, planet: string, meets: ReadonlyMap<string, number>): PlatoonView[] {
  const pl = phase.planets.find((p) => p.name === planet);
  if (!pl) throw new Error(`No planet ${planet} in phase ${phase.phase}`);
  const state = plan.planets.find((p) => p.planet === planet)!.platoons;
  const spare = (id: string) =>
    (meets.get(id) ?? 0) - [...(plan.planned.get(id)?.values() ?? [])].reduce((a, n) => a + n, 0);

  return pl.platoons.map((platoon, i) => {
    const demand = demandOf(platoon);
    const lacking = new Map<string, number>();
    if (!state[i]) for (const [id, n] of demand) if (spare(id) < n) lacking.set(id, n);
    return {
      number: i + 1,
      filled: state[i],
      slots: platoon.map((baseId) => ({ baseId, state: state[i] ? "filled" : lacking.has(baseId) ? "lacking" : "held" })),
      lacking,
    };
  });
}
