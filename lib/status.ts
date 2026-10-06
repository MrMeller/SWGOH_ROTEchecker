// Green / orange / red per unit per phase (BUILD.md §5.3). Pure functions only.
import { evaluate } from "./matching";
import type { CombatType, Phase } from "./requirements";
import type { TrimmedPlayer } from "./snapshot";

/**
 * "enough": every slot fills on day 1. "days": fills over `days` days, some players place
 * the unit again on a later day. "short": not fillable even then.
 */
export type Status = "enough" | "days" | "short";

/**
 * Days the guild spends on a phase. A player places a unit once per day and platoons stay
 * open across the daily reset, so each player has `days` placements per unit.
 */
export const DAYS_OPTIONS = [1, 2, 3] as const;
export type Days = (typeof DAYS_OPTIONS)[number];
export const DEFAULT_DAYS: Days = 2;

export interface PhaseUnitRequirement {
  baseId: string;
  name: string;
  combatType: CombatType;
  /** Phase total: slots for the unit across all platoons of the phase. */
  need: number;
  /** Planet name and slots, in the phase planet order. */
  planets: { planet: string; required: number }[];
}

export interface PhaseUnitStatus extends PhaseUnitRequirement {
  meets: number;
  owned: number;
  /** Players needed to fill every slot over `days` days: ceil(need / days). */
  floor: number;
  status: Status;
}

/** Players needed to fill `need` slots when each of them places the unit `days` times. */
export function floorFor(need: number, days: number): number {
  return Math.ceil(need / days);
}

export function statusFor(meets: number, need: number, days: number): Status {
  if (meets >= need) return "enough";
  if (meets >= floorFor(need, days)) return "days";
  return "short";
}

/** One entry per distinct unit in the phase, in first-seen order. */
export function phaseRequirements(phase: Phase): PhaseUnitRequirement[] {
  const byId = new Map<string, PhaseUnitRequirement>();
  for (const planet of phase.planets) {
    for (const u of planet.units) {
      let r = byId.get(u.baseId);
      if (!r) {
        r = { baseId: u.baseId, name: u.name, combatType: u.combatType, need: 0, planets: [] };
        byId.set(u.baseId, r);
      }
      r.need += u.required;
      r.planets.push({ planet: planet.name, required: u.required });
    }
  }
  return [...byId.values()];
}

export function phaseStatus(phase: Phase, players: readonly TrimmedPlayer[], days: number = DEFAULT_DAYS): PhaseUnitStatus[] {
  return phaseRequirements(phase).map((r) => {
    let meets = 0;
    let owned = 0;
    for (const p of players) {
      const e = evaluate(p.units[r.baseId], r.combatType, phase.minRelic);
      if (!e) continue;
      owned++;
      if (e.meets) meets++;
    }
    return { ...r, meets, owned, floor: floorFor(r.need, days), status: statusFor(meets, r.need, days) };
  });
}
