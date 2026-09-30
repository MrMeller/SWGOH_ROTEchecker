// Builds a snapshot from raw swgoh.gg responses (BUILD.md §7 "Membership changes").
// Shared by the manual browser import now and the GitHub Action sync later. Pure.
import type { Snapshot } from "./snapshot";
import { trimPlayer, type RawGuildProfile, type RawPlayer, type TrimmedPlayer } from "./swgoh";

export interface BuildResult {
  snapshot: Snapshot;
  /** Current members whose fetch failed and who had old data to reuse (marked stale). */
  stale: { allyCode: number; name: string }[];
  /** Current members with no fresh and no old data: left out of the snapshot. */
  missing: { allyCode: number; name: string }[];
}

export function buildSnapshot(
  guild: RawGuildProfile,
  players: readonly RawPlayer[],
  wanted: ReadonlySet<string>,
  syncedAt: string,
  previous?: Snapshot,
): BuildResult {
  const fresh = new Map(players.map((p) => [p.data.ally_code, p]));
  const old = new Map((previous?.players ?? []).map((p) => [p.allyCode, p]));
  const out: TrimmedPlayer[] = [];
  const stale: BuildResult["stale"] = [];
  const missing: BuildResult["missing"] = [];

  // Membership comes only from the guild profile: departed players are simply absent.
  for (const m of guild.data.members) {
    const raw = fresh.get(m.ally_code);
    if (raw) {
      out.push(trimPlayer(raw, wanted));
      continue;
    }
    const prev = old.get(m.ally_code);
    if (prev) {
      out.push({ ...prev, name: m.player_name, stale: true });
      stale.push({ allyCode: m.ally_code, name: m.player_name });
    } else {
      missing.push({ allyCode: m.ally_code, name: m.player_name });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return { snapshot: { syncedAt, memberCount: guild.data.members.length, players: out }, stale, missing };
}
