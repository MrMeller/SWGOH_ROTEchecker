// Guild sync (BUILD.md §7): guild profile -> each current member -> trim -> snapshot.
// buildSnapshot is pure; runSync does the paced fetching. File IO lives in scripts/sync.ts.
import type { Snapshot } from "./snapshot";
import {
  fetchGuildProfile,
  fetchPlayer,
  REQUEST_INTERVAL_MS,
  trimPlayer,
  type RawGuildProfile,
  type RawPlayer,
  type TrimmedPlayer,
} from "./swgoh";

export const GUILD_ID = "7JSQexIuSQeSTz94gaRsew"; // DutchJedi

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

export interface SyncOptions {
  apiKey: string;
  wanted: ReadonlySet<string>;
  previous?: Snapshot;
  guildId?: string;
  fetchImpl?: typeof fetch;
  intervalMs?: number;
  now?: () => Date;
  log?: (msg: string) => void;
}

export interface SyncResult extends BuildResult {
  failed: { allyCode: number; name: string; error: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetches the guild profile, then every current member one at a time (about 1 per second). */
export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const { apiKey, fetchImpl, intervalMs = REQUEST_INTERVAL_MS, now = () => new Date(), log = () => {} } = opts;
  const client = { apiKey, fetchImpl };

  const guild = await fetchGuildProfile(opts.guildId ?? GUILD_ID, client);
  const members = guild.data.members;
  log(`${guild.data.name}: ${members.length} members`);

  const players: RawPlayer[] = [];
  const failed: SyncResult["failed"] = [];
  for (const [i, m] of members.entries()) {
    await sleep(intervalMs);
    try {
      players.push(await fetchPlayer(m.ally_code, client));
      log(`${i + 1}/${members.length} ${m.player_name}`);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      failed.push({ allyCode: m.ally_code, name: m.player_name, error });
      log(`${i + 1}/${members.length} ${m.player_name} FAILED: ${error}`);
    }
  }

  const built = buildSnapshot(guild, players, opts.wanted, now().toISOString(), opts.previous);
  return { ...built, failed };
}
