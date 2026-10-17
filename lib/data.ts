// Server-side data access for pages. Builds requirements from the platoon data, loads the snapshot and unit names once
// per build and memoises the derived per-phase results.
import characters from "@/data/fixtures/characters.json";
import missionData from "@/data/rote-special-missions.json";
import platoons from "@/data/rote-platoons.json";
import ships from "@/data/fixtures/ships.json";
import { focusList, type FocusItem } from "./focus";
import { missionStatus, missionUnits, type Mission, type MissionData, type MissionStatus } from "./missions";
import {
  buildRequirements,
  planetSlug,
  type CatalogUnit,
  type Phase,
  type Planet,
  type PlatoonData,
  type Requirements,
} from "./requirements";
import { phasePlan, type PhasePlan } from "./plan";
import { loadSnapshot, type Snapshot } from "./snapshot";
import { DEFAULT_DAYS, phaseStatus, type Days, type PhaseUnitStatus } from "./status";

let cache: {
  req: Requirements;
  catalog: CatalogUnit[];
  missions: Mission[];
  snapshot: Snapshot;
  names: Map<string, string>;
  images: Map<string, string>;
  status: Map<string, PhaseUnitStatus[]>;
  focus: Map<string, FocusItem[]>;
  missionStatus: Map<Mission, MissionStatus>;
} | null = null;

function load() {
  if (cache) return cache;
  const catalog = [...characters, ...ships] as CatalogUnit[];
  const req = buildRequirements(platoons as PlatoonData, catalog);
  const names = new Map(catalog.map((u) => [u.base_id, u.name]));
  const images = new Map(catalog.flatMap((u) => (u.image ? [[u.base_id, u.image] as const] : [])));
  const snapshot = loadSnapshot();
  snapshot.players.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const missions = (missionData as MissionData).missions;
  cache = { req, catalog, missions, snapshot, names, images, status: new Map(), focus: new Map(), missionStatus: new Map() };
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

/** Portrait from the swgoh.gg catalog (game-assets.swgoh.gg). */
export function unitImage(baseId: string): string | undefined {
  return load().images.get(baseId);
}

/** Planet of a phase by its URL slug. */
export function findPlanet(phase: Phase, slug: string): Planet | undefined {
  return phase.planets.find((p) => planetSlug(p.name) === slug);
}

// Derived results depend on the phase and on the days the guild plays it (BUILD.md §5.3).
const key = (n: number, days: Days) => `${n}:${days}`;

export function getPhaseStatus(n: number, days: Days = DEFAULT_DAYS): PhaseUnitStatus[] {
  const c = load();
  const k = key(n, days);
  if (!c.status.has(k)) c.status.set(k, phaseStatus(getPhase(n)!, c.snapshot.players, days));
  return c.status.get(k)!;
}

export function getFocus(n: number, days: Days = DEFAULT_DAYS): FocusItem[] {
  const c = load();
  const k = key(n, days);
  if (!c.focus.has(k)) c.focus.set(k, focusList(getPhase(n)!, c.snapshot.players, days));
  return c.focus.get(k)!;
}

const plans = new Map<string, PhasePlan>();

export function getPhasePlan(n: number, days: Days = DEFAULT_DAYS): PhasePlan {
  const k = key(n, days);
  if (!plans.has(k)) {
    plans.set(k, phasePlan(getPhase(n)!, new Map(getPhaseStatus(n, days).map((u) => [u.baseId, u.meets])), days));
  }
  return plans.get(k)!;
}

/** Every distinct unit across all phases, with its display name and combat type. */
export function allUnits(): { baseId: string; name: string; combatType: 1 | 2 }[] {
  const seen = new Map<string, { baseId: string; name: string; combatType: 1 | 2 }>();
  for (const p of load().req.phases)
    for (const pl of p.planets)
      for (const u of pl.units)
        if (!seen.has(u.baseId)) seen.set(u.baseId, { baseId: u.baseId, name: unitName(u.baseId, u.name), combatType: u.combatType });
  return [...seen.values()];
}

// ---- Special missions (BUILD.md §10) ----

/** Every special mission, in data order (by phase, then map order). */
export function getMissions(): Mission[] {
  return load().missions;
}

export function missionsIn(phase: number): Mission[] {
  return load().missions.filter((m) => m.phase === phase);
}

export function missionsOn(phase: number, planet: string): Mission[] {
  return load().missions.filter((m) => m.phase === phase && m.planet === planet);
}

export function findMission(phase: number, slug: string, id: string): Mission | undefined {
  return load().missions.find((m) => m.phase === phase && planetSlug(m.planet) === slug && m.id === id);
}

export function missionHref(m: Mission): string {
  return `/phase/${m.phase}/planet/${planetSlug(m.planet)}/mission/${m.id}`;
}

export function getMissionStatus(m: Mission): MissionStatus {
  const c = load();
  if (!c.missionStatus.has(m)) c.missionStatus.set(m, missionStatus(m, c.snapshot.players, c.catalog));
  return c.missionStatus.get(m)!;
}

/**
 * False when no member has any unit outside the platoon data: the snapshot was synced before
 * the missions were tracked, so members look short on units the sync simply left out.
 */
export function snapshotCoversMissions(): boolean {
  const c = load();
  const platoonIds = new Set(c.req.phases.flatMap((p) => p.planets.flatMap((pl) => pl.platoons.flat())));
  const extra = [...missionUnits({ source: "", missions: c.missions }, c.catalog)].filter((id) => !platoonIds.has(id));
  return c.snapshot.players.some((p) => extra.some((id) => id in p.units));
}
