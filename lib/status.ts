// Green / yellow / red per unit per phase (BUILD.md §5.3). Pure functions only.
import { evaluate } from "./matching";
import type { CombatType, Phase } from "./requirements";
import type { TrimmedPlayer } from "./swgoh";

export type Status = "enough" | "planet" | "short";

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
