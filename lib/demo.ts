// Demo rosters calibrated on the June 2026 sheet counts (guildHas / guildMeets per phase),
// so the UI shows realistic green / yellow / red mixes before the real sync exists.
// Deterministic: same seed, same output.
import type { RawRow, Requirements } from "./requirements";
import type { TrimmedPlayer, TrimmedUnit } from "./swgoh";

/** The sheet was made when the guild had 50 members. */
export const SHEET_GUILD_SIZE = 50;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface UnitProfile {
  combatType: 1 | 2;
  ownFrac: number;
  /** P(relic >= minRelic | owned), per phase minimum seen in the sheet, ascending by relic. */
  survival: { relic: number; frac: number }[];
}

export function unitProfiles(req: Requirements, raw: RawRow[]): Map<string, UnitProfile> {
  const minRelic = new Map(req.phases.map((p) => [p.phase, p.minRelic]));
  const baseIdOf = new Map<string, { baseId: string; combatType: 1 | 2 }>();
  for (const p of req.phases)
    for (const pl of p.planets)
      for (const u of pl.units) baseIdOf.set(u.name, { baseId: u.baseId!, combatType: u.combatType! });

  const acc = new Map<string, { combatType: 1 | 2; has: number; meets: Map<number, number> }>();
  for (const r of raw) {
    const id = baseIdOf.get(r.name);
    if (!id) continue;
    const a = acc.get(id.baseId) ?? { combatType: id.combatType, has: 0, meets: new Map() };
    a.has = Math.max(a.has, r.guildHas);
    const relic = minRelic.get(r.phase)!;
    a.meets.set(relic, Math.max(a.meets.get(relic) ?? 0, r.guildMeets));
    acc.set(id.baseId, a);
  }

  const out = new Map<string, UnitProfile>();
  for (const [baseId, a] of acc) {
    const points = [...a.meets.entries()].sort((x, y) => x[0] - y[0]);
    // Survival must not increase with relic; fix sheet noise by carrying the max down.
    const survival = points.map(([relic, meets]) => ({ relic, frac: a.has ? meets / a.has : 0 }));
    for (let i = survival.length - 2; i >= 0; i--) survival[i].frac = Math.max(survival[i].frac, survival[i + 1].frac);
    out.set(baseId, { combatType: a.combatType, ownFrac: Math.min(1, a.has / SHEET_GUILD_SIZE), survival });
  }
  return out;
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

export function demoUnit(profile: UnitProfile, rand: () => number): TrimmedUnit | undefined {
  if (rand() >= profile.ownFrac) return undefined;
  if (profile.combatType === 2) {
    const sevenStar = profile.survival.length ? profile.survival[0].frac : 0.5;
    return { s: rand() < sevenStar ? 7 : randInt(rand, 3, 6) };
  }
  const u = rand();
  const s = profile.survival;
  let idx = -1;
  for (let i = 0; i < s.length; i++) if (s[i].frac > u) idx = i;
  if (idx >= 0) {
    const lo = s[idx].relic;
    const hi = idx + 1 < s.length ? s[idx + 1].relic - 1 : Math.min(10, lo + (rand() < 0.3 ? 1 : 0));
    return { g: 13, r: randInt(rand, lo, Math.max(lo, hi)), s: 7 };
  }
  // Below the lowest phase minimum seen: partly relicked, or still gearing.
  const floor = s.length ? s[0].relic : 5;
  if (floor > 0 && rand() < 0.5) return { g: 13, r: randInt(rand, 0, floor - 1), s: 7 };
  const g = 12 - Math.floor(rand() ** 2 * 11);
  return { g, s: rand() < 0.8 ? 7 : randInt(rand, 3, 6) };
}

export function demoPlayers(
  profiles: Map<string, UnitProfile>,
  count: number,
  seed = 42,
): TrimmedPlayer[] {
  const rand = mulberry32(seed);
  const ids = [...profiles.keys()].sort();
  return Array.from({ length: count }, (_, i) => {
    const units: Record<string, TrimmedUnit> = {};
    for (const id of ids) {
      const u = demoUnit(profiles.get(id)!, rand);
      if (u) units[id] = u;
    }
    return { allyCode: 100000001 + i, name: `Demo Player ${String(i + 1).padStart(2, "0")}`, units };
  });
}
