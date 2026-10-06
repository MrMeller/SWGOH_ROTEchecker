// Focus list (BUILD.md §6.3) and "what should I gear" (§6.4). Pure functions only.
import { playerListForUnit, type Candidate } from "./matching";
import type { Phase } from "./requirements";
import { DEFAULT_DAYS, phaseStatus, type PhaseUnitStatus } from "./status";
import type { TrimmedPlayer } from "./snapshot";

export interface FocusItem extends PhaseUnitStatus {
  /** Players still needed: need - meets. */
  gap: number;
  /** The `gap` closest players who own the unit but do not meet it yet. */
  candidates: Candidate[];
  /** False when fewer owners than the gap exist, so gearing alone cannot close it. */
  closable: boolean;
  /** Sum of candidate distances: lower means the gap closes sooner. */
  effort: number;
}

const STATUS_ORDER = { short: 0, days: 1, enough: 2 } as const;

export function focusList(phase: Phase, players: readonly TrimmedPlayer[], days: number = DEFAULT_DAYS): FocusItem[] {
  return phaseStatus(phase, players, days)
    .filter((u) => u.status !== "enough")
    .map((u) => {
      const gap = u.need - u.meets;
      const candidates = playerListForUnit(u.baseId, u.combatType, phase.minRelic, players).closest.slice(0, gap);
      const effort = candidates.reduce((a, c) => a + c.distance, 0);
      return { ...u, gap, candidates, closable: candidates.length >= gap, effort };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        Number(b.closable) - Number(a.closable) ||
        a.effort - b.effort ||
        a.name.localeCompare(b.name),
    );
}

export interface PlayerRecommendation {
  unit: FocusItem;
  candidate: Candidate;
  /** 1-based position among the unit's closest candidates. */
  rank: number;
}

/** Units the guild is short on where this player is among the closest `gap` candidates. */
export function recommendationsFor(allyCode: number, focus: readonly FocusItem[]): PlayerRecommendation[] {
  const out: PlayerRecommendation[] = [];
  for (const unit of focus) {
    const i = unit.candidates.findIndex((c) => c.allyCode === allyCode);
    if (i >= 0) out.push({ unit, candidate: unit.candidates[i], rank: i + 1 });
  }
  return out.sort(
    (a, b) =>
      a.candidate.distance - b.candidate.distance ||
      STATUS_ORDER[a.unit.status] - STATUS_ORDER[b.unit.status] ||
      a.unit.name.localeCompare(b.unit.name),
  );
}
