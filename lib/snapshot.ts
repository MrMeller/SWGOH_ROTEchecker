// Snapshot format (BUILD.md §4) and loading. Server-side only.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { TrimmedPlayer } from "./swgoh";

export interface Snapshot {
  syncedAt: string;
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
