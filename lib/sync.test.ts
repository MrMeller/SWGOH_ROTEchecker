import { describe, expect, it } from "vitest";
import type { ComlinkGuild, ComlinkPlayer } from "./comlink";
import type { Snapshot } from "./snapshot";
import { buildSnapshot, runSync, snapshotChanged } from "./sync";

const guild = (members: [string, string][]): ComlinkGuild => ({
  guild: {
    profile: { id: "G", name: "DutchJedi", memberCount: members.length },
    member: members.map(([playerId, playerName]) => ({ playerId, playerName })),
  },
});

const player = (playerId: string, ally: number, name: string, relicTier: number): ComlinkPlayer => ({
  name,
  allyCode: String(ally),
  playerId,
  rosterUnit: [
    { definitionId: "GLREY:SEVEN_STAR", currentRarity: 7, currentTier: 13, relic: { currentTier: relicTier } },
    { definitionId: "HOUNDSTOOTH:SEVEN_STAR", currentRarity: 6, currentTier: 1, relic: null },
    { definitionId: "NOTNEEDED:SEVEN_STAR", currentRarity: 7, currentTier: 13, relic: { currentTier: 9 } },
  ],
});

const wanted = new Set(["GLREY", "HOUNDSTOOTH"]);
const ships = new Set(["HOUNDSTOOTH"]);
const at = "2026-10-01T00:00:00Z";

describe("buildSnapshot", () => {
  it("trims fresh players and takes membership from the guild roster", () => {
    const { snapshot, stale, missing } = buildSnapshot(
      guild([["p1", "Bob"], ["p2", "alice"]]),
      [player("p1", 1, "Bob", 9), player("p2", 2, "alice", 7), player("p3", 3, "Departed", 12)],
      wanted,
      ships,
      at,
    );
    expect(snapshot.source).toBe("comlink");
    expect(snapshot.memberCount).toBe(2);
    expect(snapshot.players.map((p) => [p.name, p.allyCode, p.playerId])).toEqual([["alice", 2, "p2"], ["Bob", 1, "p1"]]);
    expect(snapshot.players[1].units).toEqual({ GLREY: { g: 13, r: 7, s: 7 }, HOUNDSTOOTH: { s: 6 } });
    expect(snapshot.demo).toBeUndefined();
    expect(stale).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("reuses old data for failed current members by player id, marked stale, and never for departed ones", () => {
    const previous: Snapshot = {
      syncedAt: "2026-09-01T00:00:00Z",
      memberCount: 3,
      players: [
        { allyCode: 2, playerId: "p2", name: "alice", units: { GLREY: { g: 13, r: 3, s: 7 } } },
        { allyCode: 9, playerId: "p9", name: "Gone", units: {} },
      ],
    };
    const { snapshot, stale, missing } = buildSnapshot(
      guild([["p1", "Bob"], ["p2", "alice (renamed)"], ["p4", "Newbie"]]),
      [player("p1", 1, "Bob", 9)],
      wanted,
      ships,
      at,
      previous,
    );
    expect(snapshot.players.map((p) => [p.name, p.allyCode, p.stale ?? false])).toEqual([
      ["alice (renamed)", 2, true],
      ["Bob", 1, false],
    ]);
    expect(stale).toEqual([{ playerId: "p2", name: "alice (renamed)" }]);
    expect(missing).toEqual([{ playerId: "p4", name: "Newbie" }]);
    expect(snapshot.memberCount).toBe(3);
  });
});

describe("snapshotChanged", () => {
  const base = buildSnapshot(guild([["p1", "Bob"]]), [player("p1", 1, "Bob", 9)], wanted, ships, at).snapshot;

  it("ignores the sync time", () => {
    expect(snapshotChanged(base, { ...base, syncedAt: "2026-10-03T00:00:00Z" })).toBe(false);
  });

  it("sees a unit, a member or a stale flag change, and a first sync", () => {
    const moved = buildSnapshot(guild([["p1", "Bob"]]), [player("p1", 1, "Bob", 10)], wanted, ships, at).snapshot;
    expect(snapshotChanged(base, moved)).toBe(true);
    const joined = buildSnapshot(guild([["p1", "Bob"], ["p2", "alice"]]), [player("p1", 1, "Bob", 9)], wanted, ships, at);
    expect(snapshotChanged(base, joined.snapshot)).toBe(true);
    const stale = buildSnapshot(guild([["p1", "Bob"]]), [], wanted, ships, at, base).snapshot;
    expect(stale.players[0].stale).toBe(true);
    expect(snapshotChanged(base, stale)).toBe(true);
    expect(snapshotChanged(undefined, base)).toBe(true);
  });
});

describe("runSync", () => {
  it("fetches the guild, then each member once by player id, and marks failures stale", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string);
      calls.push({ url, body });
      if (url.endsWith("/guild")) return Response.json(guild([["p1", "Bob"], ["p2", "alice"]]));
      if (body.payload.playerId === "p1") return Response.json(player("p1", 1, "Bob", 9));
      return new Response('{"code":6,"message":"RATEEXCEEDED"}', { status: 429 });
    }) as typeof fetch;

    const previous: Snapshot = {
      syncedAt: "2026-09-01T00:00:00Z",
      memberCount: 2,
      players: [{ allyCode: 2, playerId: "p2", name: "alice", units: {} }],
    };
    const result = await runSync({
      wanted,
      ships,
      previous,
      baseUrl: "http://comlink:3000",
      fetchImpl: fakeFetch,
      intervalMs: 0,
      now: () => new Date("2026-10-04T01:17:00Z"),
    });

    expect(calls.map((c) => c.url)).toEqual(["http://comlink:3000/guild", "http://comlink:3000/player", "http://comlink:3000/player"]);
    expect(calls[0].body).toEqual({ payload: { guildId: "7JSQexIuSQeSTz94gaRsew", includeRecentGuildActivityInfo: true }, enums: false });
    expect(calls.slice(1).map((c) => (c.body as { payload: { playerId: string } }).payload.playerId)).toEqual(["p1", "p2"]);
    expect(result.failed).toEqual([{ playerId: "p2", name: "alice", error: expect.stringContaining("rate limit") }]);
    expect(result.stale).toEqual([{ playerId: "p2", name: "alice" }]);
    expect(result.snapshot.syncedAt).toBe("2026-10-04T01:17:00.000Z");
    expect(result.changed).toBe(true);
  });

  it("reports no change when the roster is identical", async () => {
    const fakeFetch = (async (url: string) =>
      Response.json(url.endsWith("/guild") ? guild([["p1", "Bob"]]) : player("p1", 1, "Bob", 9))) as typeof fetch;
    const first = await runSync({ wanted, ships, fetchImpl: fakeFetch, intervalMs: 0 });
    const second = await runSync({ wanted, ships, previous: first.snapshot, fetchImpl: fakeFetch, intervalMs: 0 });
    expect(second.changed).toBe(false);
  });

  it("fails when the guild cannot be fetched", async () => {
    const fakeFetch = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(runSync({ wanted, ships, fetchImpl: fakeFetch, intervalMs: 0 })).rejects.toThrow(/HTTP 503/);
  });
});
