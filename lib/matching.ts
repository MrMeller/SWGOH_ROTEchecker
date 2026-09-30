// Meets / distance logic (BUILD.md §5.1, §5.2, §5.4). Pure functions only.
import type { CombatType } from "./requirements";
import type { TrimmedPlayer, TrimmedUnit } from "./swgoh";

export const MAX_GEAR = 13;
export const MAX_STARS = 7;

export interface Evaluation {
  meets: boolean;
  /** Steps on the §5.1 ladder (characters) or stars missing (ships). 0 when met. */
  distance: number;
  /** Character below 7 stars, so relics are locked. */
  needsStars: boolean;
  /** Current level as shown in game: "R8", "R0", "G12", "6★". */
  label: string;
}

/** gear 1..12 -> 1..12, G13 R0..R10 -> 13..23. G13 with relics locked counts as 13. */
export function ladderStep(u: TrimmedUnit): number {
  const g = u.g ?? 0;
  return g < MAX_GEAR ? g : MAX_GEAR + (u.r ?? 0);
}

export function ladderTarget(minRelic: number): number {
  return MAX_GEAR + minRelic;
}

export function levelLabel(u: TrimmedUnit, combatType: CombatType): string {
  if (combatType === 2) return `${u.s}★`;
  return u.g === MAX_GEAR && u.r !== undefined ? `R${u.r}` : `G${u.g}`;
}

/** Returns undefined when the player does not own the unit. */
export function evaluate(
  u: TrimmedUnit | undefined,
  combatType: CombatType,
  minRelic: number,
): Evaluation | undefined {
  if (!u) return undefined;
  const label = levelLabel(u, combatType);
  if (combatType === 2) {
    return { meets: u.s >= MAX_STARS, distance: Math.max(0, MAX_STARS - u.s), needsStars: false, label };
  }
  const meets = u.g === MAX_GEAR && u.r !== undefined && u.r >= minRelic;
  const distance = Math.max(0, ladderTarget(minRelic) - ladderStep(u));
  return { meets, distance, needsStars: u.s < MAX_STARS, label };
}

export interface Candidate extends Evaluation {
  allyCode: number;
  name: string;
  stale?: boolean;
}

export interface UnitPlayerList {
  meets: Candidate[];
  /** Owned but not there yet, closest first (§5.4). */
  closest: Candidate[];
  notOwned: number;
}

/** Closest first; at equal distance, 7-star characters before ones that need stars; then by name. */
export function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    a.distance - b.distance ||
    Number(a.needsStars) - Number(b.needsStars) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function playerListForUnit(
  baseId: string,
  combatType: CombatType,
  minRelic: number,
  players: readonly TrimmedPlayer[],
): UnitPlayerList {
  const list: UnitPlayerList = { meets: [], closest: [], notOwned: 0 };
  for (const p of players) {
    const e = evaluate(p.units[baseId], combatType, minRelic);
    if (!e) {
      list.notOwned++;
      continue;
    }
    const c: Candidate = { ...e, allyCode: p.allyCode, name: p.name, ...(p.stale ? { stale: true } : {}) };
    (e.meets ? list.meets : list.closest).push(c);
  }
  list.meets.sort(compareCandidates);
  list.closest.sort(compareCandidates);
  return list;
}
