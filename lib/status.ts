// Green / yellow / red per unit per phase (BUILD.md §5.3). Pure functions only.
import { evaluate } from "./matching";
import type { CombatType, Phase } from "./requirements";
import type { TrimmedPlayer } from "./swgoh";

export type Status = "enough" | "planet" | "short";

export const STATUS_COLOUR: Record<Status, "green" | "yellow" | "red"> = {
  enough: "green",
  planet: "yellow",
  short: "red",
};

export interface PhaseUnitRequirement {
  baseId: string;
  name: string;
  combatType: CombatType;
  /** Phase total: a player fills a unit once per phase, across all planets. */
  need: number;
  maxPlanet: number;
  planets: { alignment: string; required: number }[];
}

export interface PhaseUnitStatus extends PhaseUnitRequirement {
  meets: number;
  owned: number;
  status: Status;
}

export function statusFor(meets: number, need: number, maxPlanet: number): Status {
  if (meets >= need) return "enough";
  if (meets >= maxPlanet) return "planet";
  return "short";
}

/** One entry per distinct unit in the phase, in first-seen order. */
export function phaseRequirements(phase: Phase): PhaseUnitRequirement[] {
  const byId = new Map<string, PhaseUnitRequirement>();
  for (const planet of phase.planets) {
    for (const u of planet.units) {
      if (!u.baseId || !u.combatType) throw new Error(`"${u.name}" has no baseId; run npm run validate -- --write`);
      let r = byId.get(u.baseId);
      if (!r) {
        r = { baseId: u.baseId, name: u.name, combatType: u.combatType, need: 0, maxPlanet: 0, planets: [] };
        byId.set(u.baseId, r);
      }
      r.need += u.required;
      r.maxPlanet = Math.max(r.maxPlanet, u.required);
      r.planets.push({ alignment: planet.alignment, required: u.required });
    }
  }
  return [...byId.values()];
}

/** In-game map order: Dark Side left, Mixed middle, Light Side right. */
export const PLANET_ORDER = ["Dark Side", "Mixed", "Light Side"] as const;

export interface PlanetFill {
  alignment: string;
  /** 0 when the unit is not needed on this planet in this phase. */
  required: number;
  /** Enough players meet the requirement to fill this planet on its own. */
  fillableAlone: boolean;
  /** Part of at least one best combination (see planetPlan). */
  inBestPlan: boolean;
}

export interface PlanetPlan {
  planets: PlanetFill[];
  /** Every combination that fills the most planets at once (ties broken by most slots). */
  bestPlans: string[][];
  /** How many of the planets that need the unit can be filled at the same time. */
  maxAtOnce: number;
  needed: number;
}

/**
 * Which planets can be filled together, given that each meeting player fills the unit
 * once per phase. Always returns the three planets in map order.
 */
export function planetPlan(planets: readonly { alignment: string; required: number }[], meets: number): PlanetPlan {
  const needed = PLANET_ORDER.map((alignment) => ({
    alignment,
    required: planets.find((p) => p.alignment === alignment)?.required ?? 0,
  }));
  const active = needed.filter((p) => p.required > 0);

  let best: { names: string[]; slots: number }[] = [];
  for (let mask = 1; mask < 1 << active.length; mask++) {
    const subset = active.filter((_, i) => mask & (1 << i));
    const slots = subset.reduce((a, p) => a + p.required, 0);
    if (slots > meets) continue;
    const cur = best[0];
    const better = !cur || subset.length > cur.names.length || (subset.length === cur.names.length && slots > cur.slots);
    const tie = cur && subset.length === cur.names.length && slots === cur.slots;
    const entry = { names: subset.map((p) => p.alignment), slots };
    if (better) best = [entry];
    else if (tie) best.push(entry);
  }
  const inBest = new Set(best.flatMap((b) => b.names));

  return {
    planets: needed.map((p) => ({
      ...p,
      fillableAlone: p.required > 0 && meets >= p.required,
      inBestPlan: inBest.has(p.alignment),
    })),
    bestPlans: best.map((b) => b.names),
    maxAtOnce: best[0]?.names.length ?? 0,
    needed: active.length,
  };
}

export function phaseStatus(phase: Phase, players: readonly TrimmedPlayer[]): PhaseUnitStatus[] {
  return phaseRequirements(phase).map((r) => {
    let meets = 0;
    let owned = 0;
    for (const p of players) {
      const e = evaluate(p.units[r.baseId], r.combatType, phase.minRelic);
      if (!e) continue;
      owned++;
      if (e.meets) meets++;
    }
    return { ...r, meets, owned, status: statusFor(meets, r.need, r.maxPlanet) };
  });
}
