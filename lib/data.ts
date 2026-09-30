// Server-side data access for pages. Loads requirements, snapshot and unit names once
// per build and memoises the derived per-phase results.
import characters from "@/data/fixtures/characters.json";
import requirements from "@/data/rote-requirements.json";
import ships from "@/data/fixtures/ships.json";
import { focusList, type FocusItem } from "./focus";
import type { CatalogUnit, Phase, Requirements } from "./requirements";
import { loadSnapshot, type Snapshot } from "./snapshot";
import { phaseStatus, type PhaseUnitStatus } from "./status";

let cache: {
  req: Requirements;
  snapshot: Snapshot;
  names: Map<string, string>;
  status: Map<number, PhaseUnitStatus[]>;
  focus: Map<number, FocusItem[]>;
} | null = null;

function load() {
  if (cache) return cache;
  const req = requirements as Requirements;
  const catalog = [...characters, ...ships] as CatalogUnit[];
  const names = new Map(catalog.map((u) => [u.base_id, u.name]));
  const snapshot = loadSnapshot();
  snapshot.players.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  cache = { req, snapshot, names, status: new Map(), focus: new Map() };
  return cache;
}

export const PHASES = [1, 2, 3, 4, 5, 6] as const;

export function getRequirements(): Requirements {
  return load().req;
}

export function getPhase(n: number): Phase | undefined {
  return load().req.phases.find((p) => p.phase === n);
}

export function getSnapshot(): Snapshot {
  return load().snapshot;
}

/** In-game display name from the swgoh.gg catalog, falling back to the sheet name. */
export function unitName(baseId: string, fallback = baseId): string {
  return load().names.get(baseId) ?? fallback;
}

export function getPhaseStatus(n: number): PhaseUnitStatus[] {
  const c = load();
  if (!c.status.has(n)) c.status.set(n, phaseStatus(getPhase(n)!, c.snapshot.players));
  return c.status.get(n)!;
}

export function getFocus(n: number): FocusItem[] {
  const c = load();
  if (!c.focus.has(n)) c.focus.set(n, focusList(getPhase(n)!, c.snapshot.players));
  return c.focus.get(n)!;
}

/** Every distinct unit across all phases, with its display name and combat type. */
export function allUnits(): { baseId: string; name: string; combatType: 1 | 2 }[] {
  const seen = new Map<string, { baseId: string; name: string; combatType: 1 | 2 }>();
  for (const p of load().req.phases)
    for (const pl of p.planets)
      for (const u of pl.units)
        if (!seen.has(u.baseId!)) seen.set(u.baseId!, { baseId: u.baseId!, name: unitName(u.baseId!, u.name), combatType: u.combatType! });
  return [...seen.values()];
}
