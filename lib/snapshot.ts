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

const SNAPSHOT_DIR = path.join(process.cwd(), "data/snapshots");

/** latest.json from the sync when it exists, otherwise the generated demo snapshot. */
export function loadSnapshot(): Snapshot {
  for (const file of ["latest.json", "demo.json"]) {
    const p = path.join(SNAPSHOT_DIR, file);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")) as Snapshot;
  }
  throw new Error("No snapshot found in data/snapshots/ (run npm run demo or npm run sync)");
}
