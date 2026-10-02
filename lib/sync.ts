// Guild sync (BUILD.md §7): /guild -> /player for each current member -> trim -> snapshot.
// buildSnapshot and snapshotChanged are pure; runSync does the paced fetching. File IO lives in scripts/sync.ts.
import {
  fetchGuild,
  fetchPlayer,
  REQUEST_INTERVAL_MS,
  trimPlayer,
  type ComlinkGuild,
  type ComlinkPlayer,
} from "./comlink";
import type { Snapshot, TrimmedPlayer } from "./snapshot";

export const GUILD_ID = "7JSQexIuSQeSTz94gaRsew"; // DutchJedi

export interface MemberRef {
  playerId: string;
  name: string;
}

export interface BuildResult {
  snapshot: Snapshot;
  /** Current members whose fetch failed and who had old data to reuse (marked stale). */
  stale: MemberRef[];
  /** Current members with no fresh and no old data: left out of the snapshot. */
  missing: MemberRef[];
}

export function buildSnapshot(
  guild: ComlinkGuild,
  players: readonly ComlinkPlayer[],
  wanted: ReadonlySet<string>,
  ships: ReadonlySet<string>,
  syncedAt: string,
  previous?: Snapshot,
): BuildResult {
  const fresh = new Map(players.map((p) => [p.playerId, p]));
  const old = new Map((previous?.players ?? []).flatMap((p) => (p.playerId ? [[p.playerId, p] as const] : [])));
  const out: TrimmedPlayer[] = [];
  const stale: MemberRef[] = [];
  const missing: MemberRef[] = [];

  // Membership comes only from the guild roster: departed players are simply absent.
  for (const m of guild.guild.member) {
    const raw = fresh.get(m.playerId);
    if (raw) {
      out.push(trimPlayer(raw, wanted, ships));
      continue;
    }
    const prev = old.get(m.playerId);
    if (prev) {
      out.push({ ...prev, name: m.playerName, stale: true });
      stale.push({ playerId: m.playerId, name: m.playerName });
    } else {
      missing.push({ playerId: m.playerId, name: m.playerName });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const snapshot: Snapshot = { syncedAt, source: "comlink", memberCount: guild.guild.member.length, players: out };
  return { snapshot, stale, missing };
}

/** True when anything but the sync time differs, so a quiet sync writes and commits nothing. */
export function snapshotChanged(previous: Snapshot | undefined, next: Snapshot): boolean {
  if (!previous) return true;
  const strip = ({ syncedAt: _ignored, ...rest }: Snapshot) => rest;
  return JSON.stringify(strip(previous)) !== JSON.stringify(strip(next));
}

export interface SyncOptions {
  wanted: ReadonlySet<string>;
  ships: ReadonlySet<string>;
  previous?: Snapshot;
  guildId?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  intervalMs?: number;
  now?: () => Date;
  log?: (msg: string) => void;
}

export interface SyncResult extends BuildResult {
  failed: (MemberRef & { error: string })[];
  changed: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetches the guild roster, then every current member one at a time (about 1 per second). */
export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const { baseUrl, fetchImpl, intervalMs = REQUEST_INTERVAL_MS, now = () => new Date(), log = () => {} } = opts;
  const client = { baseUrl, fetchImpl };

  const guild = await fetchGuild(opts.guildId ?? GUILD_ID, client);
  const members = guild.guild.member;
  log(`${guild.guild.profile.name}: ${members.length} members`);

  const players: ComlinkPlayer[] = [];
  const failed: SyncResult["failed"] = [];
  for (const [i, m] of members.entries()) {
    await sleep(intervalMs);
    try {
      players.push(await fetchPlayer(m.playerId, client));
      log(`${i + 1}/${members.length} ${m.playerName}`);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      failed.push({ playerId: m.playerId, name: m.playerName, error });
      log(`${i + 1}/${members.length} ${m.playerName} FAILED: ${error}`);
    }
  }

  const built = buildSnapshot(guild, players, opts.wanted, opts.ships, now().toISOString(), opts.previous);
  return { ...built, failed, changed: snapshotChanged(opts.previous, built.snapshot) };
}
