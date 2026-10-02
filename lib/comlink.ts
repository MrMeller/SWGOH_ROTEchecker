// swgoh-comlink client (server-side only, used by the sync) and the trim-on-ingest step.
// Comlink runs next to the sync as a service container (BUILD.md §7). Field names and the
// relic offset are pinned by lib/comlink.test.ts against reduced real responses in data/fixtures/.
import type { TrimmedPlayer, TrimmedUnit } from "./snapshot";

export const DEFAULT_COMLINK_URL = "http://localhost:3000";
export const USER_AGENT =
  "DutchJedi-RotE-Tracker/0.2 (+https://github.com/MrMeller/SWGOH_ROTEchecker; guild sync every other night)";
/** CG allows about 20 requests per second per IP; we stay far below that. */
export const REQUEST_INTERVAL_MS = 1000;

/** Comlink reports relic.currentTier shifted by 2: 1 = locked, 2 = R0 ... 12 = R10. Ships have null. */
export const RELIC_TIER_OFFSET = 2;

// ---- Raw payload types (only the fields we read) ----

export interface ComlinkMember {
  playerId: string;
  playerName: string;
  memberLevel?: number;
  /** Epoch milliseconds, as a string. */
  lastActivityTime?: string;
  /** Epoch seconds, as a string. */
  guildJoinTime?: string;
}

export interface ComlinkGuild {
  guild: {
    profile: { id: string; name: string; memberCount: number; memberMax?: number };
    member: ComlinkMember[];
  };
}

export interface RosterUnit {
  /** "BASEID:SEVEN_STAR" */
  definitionId: string;
  currentRarity: number;
  /** Gear level. */
  currentTier: number;
  currentLevel?: number;
  relic: { currentTier: number } | null;
}

export interface ComlinkPlayer {
  name: string;
  /** Comlink sends the ally code as a string. */
  allyCode: string | number;
  playerId: string;
  guildId?: string;
  rosterUnit: RosterUnit[];
}

/** The base_id is the part of definitionId before the colon. */
export function baseIdOf(definitionId: string): string {
  const i = definitionId.indexOf(":");
  return i < 0 ? definitionId : definitionId.slice(0, i);
}

export function relicFromTier(relicTier: number | null | undefined): number | undefined {
  if (relicTier == null) return undefined;
  const relic = relicTier - RELIC_TIER_OFFSET;
  return relic >= 0 ? relic : undefined;
}

/**
 * Keep only units in the requirements dataset, and only gear, relic and stars.
 * Combat type is not in the payload, so ships are given as a set of base_ids.
 */
export function trimPlayer(raw: ComlinkPlayer, wanted: ReadonlySet<string>, ships: ReadonlySet<string>): TrimmedPlayer {
  const units: Record<string, TrimmedUnit> = {};
  for (const u of raw.rosterUnit) {
    const baseId = baseIdOf(u.definitionId);
    if (!wanted.has(baseId)) continue;
    if (ships.has(baseId)) {
      units[baseId] = { s: u.currentRarity };
      continue;
    }
    const t: TrimmedUnit = { g: u.currentTier, s: u.currentRarity };
    const relic = u.currentTier === 13 ? relicFromTier(u.relic?.currentTier) : undefined;
    if (relic !== undefined) t.r = relic;
    units[baseId] = t;
  }
  return { allyCode: Number(raw.allyCode), playerId: raw.playerId, name: raw.name, units };
}

// ---- HTTP ----

export class ComlinkError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Comlink's own error code when the body had one (6 = rate exceeded, 32 = not found). */
    readonly code?: number,
  ) {
    super(message);
    this.name = "ComlinkError";
  }
}

export interface ClientOptions {
  /** Where comlink listens, default http://localhost:3000 (the service container in the Action). */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

async function postJson<T>(path: string, body: unknown, { baseUrl = DEFAULT_COMLINK_URL, fetchImpl = fetch }: ClientOptions): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ComlinkError(`Cannot reach comlink at ${url}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const text = await res.text();
    let code: number | undefined;
    let detail = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text) as { code?: number; message?: string };
      code = parsed.code;
      if (parsed.message) detail = parsed.message;
    } catch {
      // not a comlink error body
    }
    const hint = code === 6 ? " (rate limit exceeded)" : code === 32 ? " (record not found)" : "";
    throw new ComlinkError(`HTTP ${res.status} for POST ${path}${hint}: ${detail}`, res.status, code);
  }
  return (await res.json()) as T;
}

export function fetchGuild(guildId: string, opts: ClientOptions = {}): Promise<ComlinkGuild> {
  return postJson("/guild", { payload: { guildId, includeRecentGuildActivityInfo: true }, enums: false }, opts);
}

export function fetchPlayer(playerId: string, opts: ClientOptions = {}): Promise<ComlinkPlayer> {
  return postJson("/player", { payload: { playerId }, enums: false }, opts);
}
