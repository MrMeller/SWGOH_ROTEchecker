// Special missions (BUILD.md §10). Some planets have a special mission: a squad requirement a
// member either meets or not, one attempt per account. The guild-level number is how many
// members are ready. Pure functions only; IO lives in lib/data.ts and the scripts.
import { evaluate, ladderTarget } from "./matching";
import { wantedUnits, type CatalogUnit, type PlatoonData } from "./requirements";
import type { TrimmedPlayer } from "./snapshot";

export interface MissionReward {
  /** As named in game, plural where the amount is: "Mk II Guild Event Tokens", "Third Sister shard". */
  item: string;
  amount: number;
}

export interface MissionUnlock {
  /** Bonus planet that opens once the guild has this many wins. */
  planet: string;
  wins: number;
}

export interface Mission {
  /** URL slug, unique per planet. */
  id: string;
  phase: number;
  planet: string;
  title: string;
  /** Characters the squad needs at the relic, named ones included. */
  squad: number;
  minRelic: number;
  /** Catalog tag the squad must carry ("Nightsister"), or null when any character counts. */
  tag: string | null;
  /** Units that must be in the squad. */
  required: string[];
  /** Groups of which one unit must be in the squad ("Any Cal Kestis"). */
  anyOf: string[][];
  reward: MissionReward;
  unlocks: MissionUnlock | null;
}

export interface MissionData {
  source: string;
  missions: Mission[];
}

const namedUnits = (m: Mission): string[] => [...m.required, ...m.anyOf.flat()];
const isCharacter = (u: CatalogUnit) => u.combat_type !== 2;
const hasTag = (u: CatalogUnit, tag: string) => (u.categories ?? []).includes(tag);

// ---- Validation (npm run validate) ----

export function checkMissions(data: MissionData, platoons: PlatoonData, catalog: readonly CatalogUnit[]): string[] {
  const errors: string[] = [];
  const byId = new Map(catalog.map((u) => [u.base_id, u]));
  const tags = new Set(catalog.flatMap((u) => u.categories ?? []));
  const planets = platoons.phases.flatMap((p) => p.planets.map((pl) => ({ ...pl, phase: p.phase })));
  const seen = new Set<string>();

  for (const m of data.missions) {
    const where = `P${m.phase} ${m.planet} ${m.id}`;
    const key = `${m.phase}/${m.planet}/${m.id}`;
    if (seen.has(key)) errors.push(`${where}: duplicate id`);
    seen.add(key);
    if (!/^[a-z0-9-]+$/.test(m.id)) errors.push(`${where}: id must be a URL slug`);
    if (!planets.some((p) => p.phase === m.phase && p.name === m.planet)) errors.push(`${where}: no planet ${m.planet} in phase ${m.phase}`);
    if (!Number.isInteger(m.minRelic) || m.minRelic < 0 || m.minRelic > 10) errors.push(`${where}: minRelic must be 0 to 10`);

    const named = namedUnits(m);
    const namedSlots = m.required.length + m.anyOf.length;
    if (!Number.isInteger(m.squad) || m.squad < Math.max(1, namedSlots)) errors.push(`${where}: squad ${m.squad} is smaller than the named units`);
    if (new Set(named).size !== named.length) errors.push(`${where}: a unit is named twice`);
    for (const g of m.anyOf) if (g.length < 2) errors.push(`${where}: an anyOf group needs at least two units`);
    if (m.tag !== null && !tags.has(m.tag)) errors.push(`${where}: no unit in the catalog has the tag ${m.tag}`);
    for (const id of named) {
      const u = byId.get(id);
      if (!u) {
        errors.push(`${where}: unknown base_id ${id}`);
        continue;
      }
      if (!isCharacter(u)) errors.push(`${where}: ${id} is a ship`);
      if (m.tag !== null && !hasTag(u, m.tag)) errors.push(`${where}: ${id} does not carry the tag ${m.tag}`);
    }

    if (!m.reward?.item || !(m.reward.amount > 0)) errors.push(`${where}: reward needs an item and an amount`);
    if (m.unlocks) {
      const bonus = planets.find((p) => p.name === m.unlocks!.planet);
      if (!bonus?.bonus) errors.push(`${where}: unlocks ${m.unlocks.planet}, which is not a bonus planet`);
      else if (bonus.phase <= m.phase) errors.push(`${where}: unlocks ${m.unlocks.planet}, which is not in a later phase`);
      if (!(m.unlocks.wins > 0)) errors.push(`${where}: unlocks needs a number of wins`);
    }
  }
  return errors;
}

// ---- Unit pools ----

/**
 * Characters that can be in the squad: the named units, plus (when the squad is bigger than
 * the named units) every character with the tag, or every character when there is no tag.
 */
export function missionPool(m: Mission, catalog: readonly CatalogUnit[]): string[] {
  const ids = new Set(namedUnits(m));
  if (m.squad > m.required.length + m.anyOf.length) {
    for (const u of catalog) if (isCharacter(u) && (m.tag === null || hasTag(u, m.tag))) ids.add(u.base_id);
  }
  return [...ids];
}

/** Every unit any mission can use. */
export function missionUnits(data: MissionData, catalog: readonly CatalogUnit[]): Set<string> {
  return new Set(data.missions.flatMap((m) => missionPool(m, catalog)));
}

/** What the sync keeps per player: every platoon unit plus every unit a mission can use. */
export function keptUnits(platoons: PlatoonData, missions: MissionData, catalog: readonly CatalogUnit[]): Set<string> {
  return new Set([...wantedUnits(platoons), ...missionUnits(missions, catalog)]);
}

// ---- One member ----

export interface UnitGap {
  baseId: string;
  /** Current level as in game ("R5", "G12"), or "not owned". */
  label: string;
  /** Ladder steps to the relic (§5.1); the whole ladder when not owned. */
  distance: number;
  owned: boolean;
  needsStars: boolean;
}

export interface MissionEvaluation {
  ready: boolean;
  /** Pool units at the relic, named ones included. */
  atLevel: number;
  /** Named units below the relic: every required unit, and the closest option of each anyOf group. */
  named: UnitGap[];
  /** Pool units still needed beyond the named ones: squad minus atLevel minus the named gaps, at least 0. */
  fillersNeeded: number;
  /** The closest owned pool units for those, fewer when the member owns too few. */
  fillers: UnitGap[];
  /** Units short in total: named gaps plus fillers needed. 0 when ready. */
  missing: number;
  /** Ladder steps to go over the named gaps and the fillers; a filler not owned counts the whole ladder. */
  effort: number;
}

function gapFor(player: TrimmedPlayer, baseId: string, minRelic: number): { gap: UnitGap; meets: boolean } {
  const e = evaluate(player.units[baseId], 1, minRelic);
  if (!e) return { gap: { baseId, label: "not owned", distance: ladderTarget(minRelic), owned: false, needsStars: true }, meets: false };
  return { gap: { baseId, label: e.label, distance: e.distance, owned: true, needsStars: e.needsStars }, meets: e.meets };
}

/** Owned before not owned, then closest first, then 7-star units before ones that need stars. */
const byGap = (a: UnitGap, b: UnitGap) =>
  Number(b.owned) - Number(a.owned) || a.distance - b.distance || Number(a.needsStars) - Number(b.needsStars);

export function evaluateMission(player: TrimmedPlayer, m: Mission, pool: readonly string[]): MissionEvaluation {
  const namedIds = new Set(namedUnits(m));
  let atLevel = 0;
  const below: UnitGap[] = [];
  for (const id of pool) {
    const { gap, meets } = gapFor(player, id, m.minRelic);
    if (meets) atLevel++;
    else if (gap.owned && !namedIds.has(id)) below.push(gap);
  }

  const named: UnitGap[] = [];
  for (const id of m.required) {
    const { gap, meets } = gapFor(player, id, m.minRelic);
    if (!meets) named.push(gap);
  }
  for (const group of m.anyOf) {
    const options = group.map((id) => gapFor(player, id, m.minRelic));
    if (!options.some((o) => o.meets)) named.push(options.map((o) => o.gap).sort(byGap)[0]);
  }

  const fillersNeeded = Math.max(0, m.squad - atLevel - named.length);
  const fillers = below.sort(byGap).slice(0, fillersNeeded);
  const notOwned = fillersNeeded - fillers.length;
  const effort = [...named, ...fillers].reduce((a, g) => a + g.distance, 0) + notOwned * ladderTarget(m.minRelic);
  const missing = named.length + fillersNeeded;
  return { ready: missing === 0, atLevel, named, fillersNeeded, fillers, missing, effort };
}

// ---- The guild ----

export interface MissionCandidate extends MissionEvaluation {
  allyCode: number;
  name: string;
  stale?: boolean;
}

export interface MissionPoolUnit {
  baseId: string;
  name: string;
  named: boolean;
  /** Members with the unit at the relic. */
  atLevel: number;
  owned: number;
}

export type UnlockStatus = "enough" | "close" | "short";

/** Within this many members of the wins needed counts as close. */
export const UNLOCK_CLOSE = 5;

export function unlockStatusFor(ready: number, wins: number): UnlockStatus {
  if (ready >= wins) return "enough";
  if (ready + UNLOCK_CLOSE >= wins) return "close";
  return "short";
}

export interface MissionStatus {
  mission: Mission;
  ready: MissionCandidate[];
  /** Fewest units short first, then least effort, then by name. */
  notReady: MissionCandidate[];
  /** The pool, most members at the relic first. */
  units: MissionPoolUnit[];
  unlock?: MissionUnlock & { status: UnlockStatus; gap: number };
  /**
   * Named units (or whole anyOf groups) no member has an entry for. The sync keeps only
   * units it knows about, so this means the snapshot predates the mission list.
   */
  uncovered: string[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export function compareNotReady(a: MissionCandidate, b: MissionCandidate): number {
  return a.missing - b.missing || a.effort - b.effort || byName(a, b);
}

export function missionStatus(m: Mission, players: readonly TrimmedPlayer[], catalog: readonly CatalogUnit[]): MissionStatus {
  const pool = missionPool(m, catalog);
  const names = new Map(catalog.map((u) => [u.base_id, u.name]));
  const namedIds = new Set(namedUnits(m));

  const ready: MissionCandidate[] = [];
  const notReady: MissionCandidate[] = [];
  for (const p of players) {
    const c: MissionCandidate = { ...evaluateMission(p, m, pool), allyCode: p.allyCode, name: p.name, ...(p.stale ? { stale: true } : {}) };
    (c.ready ? ready : notReady).push(c);
  }
  ready.sort(byName);
  notReady.sort(compareNotReady);

  const units = pool
    .map((baseId) => {
      let atLevel = 0;
      let owned = 0;
      for (const p of players) {
        const e = evaluate(p.units[baseId], 1, m.minRelic);
        if (!e) continue;
        owned++;
        if (e.meets) atLevel++;
      }
      return { baseId, name: names.get(baseId) ?? baseId, named: namedIds.has(baseId), atLevel, owned };
    })
    .sort((a, b) => b.atLevel - a.atLevel || b.owned - a.owned || byName(a, b));

  const present = new Set(players.flatMap((p) => Object.keys(p.units)));
  const uncovered = [
    ...m.required.filter((id) => !present.has(id)),
    ...m.anyOf.filter((g) => g.every((id) => !present.has(id))).flat(),
  ];

  const status: MissionStatus = { mission: m, ready, notReady, units, uncovered };
  if (m.unlocks) {
    status.unlock = { ...m.unlocks, status: unlockStatusFor(ready.length, m.unlocks.wins), gap: Math.max(0, m.unlocks.wins - ready.length) };
  }
  return status;
}

// ---- Text ----

const TAG_PLURAL: Record<string, string> = { Inquisitorius: "Inquisitorius" };

export function tagPlural(tag: string, n: number): string {
  return n === 1 ? tag : (TAG_PLURAL[tag] ?? `${tag}s`);
}

function joinWords(words: string[], last: string): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} ${last} ${words.at(-1)}`;
}

/** The requirement as one line: "5 Nightsisters at R7 or higher, including Merrin". */
export function missionRequirement(m: Mission, name: (baseId: string) => string): string {
  const named = [...m.required.map(name), ...m.anyOf.map((g) => joinWords(g.map(name), "or"))];
  const relic = `at R${m.minRelic} or higher`;
  if (m.squad <= m.required.length + m.anyOf.length) return `${joinWords(named, "and")} ${relic}`;
  const squad = m.tag ? `${m.squad} ${tagPlural(m.tag, m.squad)}` : `Any ${m.squad} characters`;
  return named.length ? `${squad} ${relic}, including ${joinWords(named, "and")}` : `${squad} ${relic}`;
}

export function rewardText(r: MissionReward): string {
  return `${r.amount} ${r.item} per win`;
}

/** What a member still lacks, as one line: "Merrin R5, 1 more Nightsister (closest Talia R6)". */
export function missingText(e: MissionEvaluation, m: Mission, name: (baseId: string) => string, detail = true): string {
  if (e.ready) return "Ready";
  const parts = e.named.map((g) => `${name(g.baseId)} ${g.label}`);
  if (e.fillersNeeded > 0) {
    const what = m.tag ? tagPlural(m.tag, e.fillersNeeded) : `character${e.fillersNeeded === 1 ? "" : "s"}`;
    const closest = detail ? e.fillers.map((g) => `${name(g.baseId)} ${g.label}`) : [];
    const owned = detail && e.fillers.length < e.fillersNeeded ? `, owns only ${e.fillers.length} more` : "";
    parts.push(`${e.fillersNeeded} more ${what}${closest.length ? ` (closest ${closest.join(", ")})` : ""}${owned}`);
  }
  return parts.join(", ");
}

// ---- Focus list (BUILD.md §6.3) ----

/** Members listed per mission in the focus list when there is no unlock gap to close. */
export const MISSION_FOCUS_LIMIT = 5;

export interface MissionFocusItem {
  status: MissionStatus;
  /** Who to ask: the members that close an unlock gap, otherwise the closest few. */
  candidates: MissionCandidate[];
}

export function missionFocus(status: MissionStatus, limit = MISSION_FOCUS_LIMIT): MissionFocusItem {
  const n = status.unlock ? status.unlock.gap : limit;
  return { status, candidates: status.notReady.slice(0, n) };
}
