// Platoon plan for a phase. A platoon only scores when all 15 slots are filled, and each
// player places a unit once per day, so platoons compete for the same players across all
// planets of the phase. Over `days` days every unit has `meets × days` placements. The plan is
// the largest set of platoons fillable over those days, built around the largest set fillable
// on day 1 (BUILD.md §5.5). Pure functions only.
import type { Phase } from "./requirements";
import { DEFAULT_DAYS } from "./status";

/** Units needed per platoon: base_id -> slots. */
type Demand = Map<string, number>;

interface PlatoonRef {
  planet: string;
  index: number;
  bonus: boolean;
  demand: Demand;
}

/**
 * How the plan fills a platoon: on day 1, on a later day (some players place a unit again
 * after the daily reset), or not at all. Truthy when filled.
 */
export type Fill = "day1" | "later" | false;

export interface PlanetPlan {
  planet: string;
  /** One entry per platoon, in board order. */
  platoons: Fill[];
  /** Platoons the plan fills, on any day. */
  filled: number;
  /** Platoons the plan fills on day 1. */
  firstDay: number;
}

export interface PhasePlan {
  /** Days the guild spends on the phase: placements per player per unit. */
  days: number;
  planets: PlanetPlan[];
  filled: number;
  firstDay: number;
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

const sum = (xs: Iterable<number>) => [...xs].reduce((a, n) => a + n, 0);

/** Default search budget: plenty for 18 to 24 platoons, and keeps builds fast in the worst case. */
const NODE_LIMIT = 2_000_000;

/**
 * Largest set of platoons whose combined demand fits the supply (placements per unit).
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

/**
 * The plan for a phase given how many players meet each unit. Day 1 first: the largest set
 * fillable with one placement per player. Then the largest extension of that set with
 * `meets × days` placements. Keeping the day-1 set fixed can in theory cost a platoon against
 * the unconstrained maximum over all days, but platoons filled on day 1 give their bonus on
 * every day, so the plan prefers them.
 */
export function phasePlan(phase: Phase, meets: ReadonlyMap<string, number>, days: number = DEFAULT_DAYS): PhasePlan {
  const refs: PlatoonRef[] = phase.planets.flatMap((pl) =>
    pl.platoons.map((platoon, index) => ({ planet: pl.name, index, bonus: pl.bonus, demand: demandOf(platoon) })),
  );
  // Prefer regular planets (bonus planets need unlocking), then platoons that need fewer
  // scarce units, so ties land on the easiest platoons.
  const pressure = (r: PlatoonRef) => [...r.demand].reduce((a, [id, n]) => a + n / Math.max(1, meets.get(id) ?? 0), 0);
  const order = refs
    .map((r, i) => ({ r, i, p: pressure(r) }))
    .sort((a, b) => Number(a.r.bonus) - Number(b.r.bonus) || a.p - b.p || a.i - b.i);
  const demands = order.map((o) => o.r.demand);

  const day1 = maxPlatoons(demands, meets);
  const fill = new Map<number, Fill>(day1.chosen.map((k) => [order[k].i, "day1"]));
  let exact = day1.exact;

  if (days > 1) {
    const left = new Map([...meets].map(([id, n]) => [id, n * days]));
    for (const k of day1.chosen) for (const [id, n] of demands[k]) left.set(id, (left.get(id) ?? 0) - n);
    const rest = order.map((o, k) => ({ o, k })).filter(({ k }) => !day1.chosen.includes(k));
    const later = maxPlatoons(rest.map(({ k }) => demands[k]), left);
    for (const j of later.chosen) fill.set(rest[j].o.i, "later");
    exact &&= later.exact;
  }

  const planned = new Map<string, Map<string, number>>();
  const planets = phase.planets.map((pl) => ({
    planet: pl.name,
    platoons: pl.platoons.map((): Fill => false),
    filled: 0,
    firstDay: 0,
  }));
  refs.forEach((r, i) => {
    const f = fill.get(i);
    if (!f) return;
    const p = planets.find((x) => x.planet === r.planet)!;
    p.platoons[r.index] = f;
    p.filled++;
    if (f === "day1") p.firstDay++;
    for (const [id, n] of r.demand) {
      const perPlanet = planned.get(id) ?? new Map<string, number>();
      perPlanet.set(r.planet, (perPlanet.get(r.planet) ?? 0) + n);
      planned.set(id, perPlanet);
    }
  });

  return {
    days,
    planets,
    filled: fill.size,
    firstDay: day1.chosen.length,
    total: refs.length,
    exact,
    planned,
  };
}

/** Slots a unit fills across the whole plan. */
const plannedTotal = (plan: PhasePlan, baseId: string) => sum(plan.planned.get(baseId)?.values() ?? []);

/** Placements of a unit the planned platoons leave unused: meets × days minus planned slots. */
export function sparePlacements(plan: PhasePlan, baseId: string, meets: number): number {
  return meets * plan.days - plannedTotal(plan, baseId);
}

export interface UnitAllocation {
  planet: string;
  /** Slots for this unit on the planet, across all six platoons. */
  required: number;
  /** Slots it fills in the planned platoons. */
  planned: number;
  /** Per platoon: undefined when the unit is not in it, else how the plan fills it. */
  platoons: (Fill | undefined)[];
  /** Open platoons on this planet this unit is short for, after the planned ones. */
  shortFor: number;
}

/** Where one unit's placements go under the phase plan, per planet in display order. */
export function unitAllocation(phase: Phase, plan: PhasePlan, baseId: string, meets: number): UnitAllocation[] {
  const planned = plan.planned.get(baseId);
  const spare = sparePlacements(plan, baseId, meets);
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

/**
 * "filled": the plan fills the platoon and this slot needs no repeat. "scarce": the platoon
 * fills on a later day and a player places this unit again for it. "lacking": an open
 * platoon's slot we have no placement for. "held": covered, but other units or planets
 * hold the platoon back.
 */
export type SlotState = "filled" | "scarce" | "lacking" | "held";

export interface PlatoonView {
  /** 1-based, as numbered on the in-game board. */
  number: number;
  fill: Fill;
  slots: { baseId: string; state: SlotState }[];
  /** Units this platoon lacks and how many more players each needs: base_id -> shortfall. */
  lacking: Map<string, number>;
}

/**
 * The six platoons of one planet with a state per slot. In a platoon filled on a later day,
 * units whose planned slots exceed the players meeting them are "scarce": someone places
 * them twice. In an open platoon a unit with N slots and S spare placements has
 * max(0, N - S) "lacking" slots, the rest "held": the missing players are what it takes to
 * open this platoon next, on top of the plan.
 */
export function platoonViews(phase: Phase, plan: PhasePlan, planet: string, meets: ReadonlyMap<string, number>): PlatoonView[] {
  const pl = phase.planets.find((p) => p.name === planet);
  if (!pl) throw new Error(`No planet ${planet} in phase ${phase.phase}`);
  const state = plan.planets.find((p) => p.planet === planet)!.platoons;
  const spare = (id: string) => sparePlacements(plan, id, meets.get(id) ?? 0);
  const repeats = (id: string) => plannedTotal(plan, id) > (meets.get(id) ?? 0);

  return pl.platoons.map((platoon, i) => {
    const fill = state[i];
    const demand = demandOf(platoon);
    const lacking = new Map<string, number>();
    if (!fill) {
      for (const [id, n] of demand) {
        const short = n - Math.max(0, spare(id));
        if (short > 0) lacking.set(id, short);
      }
    }
    // Ring the last occurrences of a unit, so the slots we can still cover come first.
    const seen = new Map<string, number>();
    const slots = platoon.map((baseId) => {
      if (fill === "day1") return { baseId, state: "filled" as const };
      if (fill === "later") return { baseId, state: repeats(baseId) ? ("scarce" as const) : ("filled" as const) };
      const k = (seen.get(baseId) ?? 0) + 1;
      seen.set(baseId, k);
      const covered = (demand.get(baseId) ?? 0) - (lacking.get(baseId) ?? 0);
      return { baseId, state: k > covered ? ("lacking" as const) : ("held" as const) };
    });
    return { number: i + 1, fill, slots, lacking };
  });
}
