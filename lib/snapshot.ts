// Snapshot format (BUILD.md §4) and loading. Server-side only.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** g = gear level, r = in-game relic (0..10, only when G13 with relics unlocked), s = stars. */
export interface TrimmedUnit {
  g?: number;
  r?: number;
  s: number;
}

export interface TrimmedPlayer {
  allyCode: number;
  /** Game player id, the key comlink's guild roster uses. Absent on generated demo players. */
  playerId?: string;
  /** Public in-game name. */
  name: string;
  units: Record<string, TrimmedUnit>;
  /** Fetch failed in the last sync; units reused from the previous snapshot. */
  stale?: boolean;
}

export interface Snapshot {
  syncedAt: string;
  /** Where the roster data came from. The real sync writes "comlink". */
  source?: "comlink";
  memberCount: number;
  players: TrimmedPlayer[];
  /** Set on generated demo data; the real sync never writes it. */
  demo?: boolean;
}

/** latest.json from the sync when it exists, otherwise the generated demo snapshot. */
export function loadSnapshot(): Snapshot {
  const latest = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "snapshots", "latest.json");
  const demo = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "snapshots", "demo.json");
  for (const p of [latest, demo]) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")) as Snapshot;
  }
  throw new Error("No snapshot found in data/snapshots/ (run npm run demo or npm run sync)");
}
