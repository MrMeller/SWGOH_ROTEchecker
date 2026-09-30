// swgoh.gg public API client (server-side only) and the trim-on-ingest step.
// Field names and the relic offset are pinned by lib/swgoh.test.ts against
// real responses saved in data/fixtures/.

export const SWGOH_BASE = "https://swgoh.gg/api";
export const USER_AGENT =
  "DutchJedi-RotE-Tracker/0.1 (+https://github.com/MrMeller/SWGOH_ROTEchecker; weekly guild sync)";
export const MAX_CONCURRENCY = 3;
const REQUEST_DELAY_MS = 250;

/** swgoh.gg stores relic_tier shifted by 2: 1 = locked, 2 = R0 ... 12 = R10. Ships are null. */
export const RELIC_TIER_OFFSET = 2;

// ---- Raw payload types (only the fields we read) ----

export interface RawGuildMember {
  ally_code: number;
  player_name: string;
  last_activity_time?: string;
  guild_join_time?: string;
}

export interface RawGuildProfile {
  data: {
    guild_id: string;
    name: string;
    member_count: number;
    members: RawGuildMember[];
  };
}

export interface RawUnit {
  data: {
    base_id: string;
    name: string;
    combat_type: number;
    gear_level: number;
    relic_tier: number | null;
    rarity: number;
  };
}

export interface RawPlayer {
  data: { ally_code: number; name: string };
  units: RawUnit[];
}

// ---- Trimmed snapshot types (BUILD.md §4) ----

/** g = gear level, r = in-game relic (0..10, only when G13 with relics unlocked), s = stars. */
export interface TrimmedUnit {
  g?: number;
  r?: number;
  s: number;
}

export interface TrimmedPlayer {
  allyCode: number;
  name: string;
  units: Record<string, TrimmedUnit>;
  stale?: boolean;
}

export function relicFromTier(relicTier: number | null | undefined): number | undefined {
  if (relicTier == null) return undefined;
  const relic = relicTier - RELIC_TIER_OFFSET;
  return relic >= 0 ? relic : undefined;
}

/** Keep only units in the requirements dataset, and only gear, relic and stars. */
export function trimPlayer(raw: RawPlayer, wanted: ReadonlySet<string>): TrimmedPlayer {
  const units: Record<string, TrimmedUnit> = {};
  for (const { data: u } of raw.units) {
    if (!wanted.has(u.base_id)) continue;
    if (u.combat_type === 2) {
      units[u.base_id] = { s: u.rarity };
      continue;
    }
    const t: TrimmedUnit = { g: u.gear_level, s: u.rarity };
    const relic = u.gear_level === 13 ? relicFromTier(u.relic_tier) : undefined;
    if (relic !== undefined) t.r = relic;
    units[u.base_id] = t;
  }
  return { allyCode: raw.data.ally_code, name: raw.data.name, units };
}

// ---- HTTP ----

export class SwgohError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SwgohError";
  }
}

async function getJson<T>(url: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (res.headers.get("cf-mitigated") === "challenge") {
    throw new SwgohError(`Blocked by a Cloudflare challenge: ${url}`, res.status);
  }
  if (!res.ok) throw new SwgohError(`HTTP ${res.status} for ${url}`, res.status);
  return (await res.json()) as T;
}

export function fetchGuildProfile(guildId: string, fetchImpl?: typeof fetch): Promise<RawGuildProfile> {
  return getJson(`${SWGOH_BASE}/guild-profile/${guildId}/`, fetchImpl);
}

export function fetchPlayer(allyCode: number, fetchImpl?: typeof fetch): Promise<RawPlayer> {
  return getJson(`${SWGOH_BASE}/player/${allyCode}/`, fetchImpl);
}

/** Run tasks with at most `limit` in flight and a small pause between starts. */
export async function mapLimited<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
  limit = MAX_CONCURRENCY,
  delayMs = REQUEST_DELAY_MS,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
