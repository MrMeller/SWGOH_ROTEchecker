import { describe, expect, it } from "vitest";
import type { Snapshot } from "./snapshot";
import { buildSnapshot } from "./sync";
import type { RawGuildProfile, RawPlayer } from "./swgoh";

const guild = (members: [number, string][]): RawGuildProfile => ({
  data: {
    guild_id: "G",
    name: "DutchJedi",
    member_count: members.length,
    members: members.map(([ally_code, player_name]) => ({ ally_code, player_name })),
  },
});

const player = (ally: number, name: string, relicTier: number): RawPlayer => ({
  data: { ally_code: ally, name },
  units: [
    { data: { base_id: "GLREY", name: "Rey", combat_type: 1, gear_level: 13, relic_tier: relicTier, rarity: 7 } },
    { data: { base_id: "NOTNEEDED", name: "x", combat_type: 1, gear_level: 13, relic_tier: 9, rarity: 7 } },
  ],
});

const wanted = new Set(["GLREY"]);

describe("buildSnapshot", () => {
  it("trims fresh players and takes membership from the guild profile", () => {
    const { snapshot, stale, missing } = buildSnapshot(
      guild([[1, "Bob"], [2, "alice"]]),
      [player(1, "Bob", 9), player(2, "alice", 7), player(3, "Departed", 12)],
      wanted,
      "2026-10-01T00:00:00Z",
    );
    expect(snapshot.memberCount).toBe(2);
    expect(snapshot.players.map((p) => p.name)).toEqual(["alice", "Bob"]);
    expect(snapshot.players[1].units).toEqual({ GLREY: { g: 13, r: 7, s: 7 } });
    expect(snapshot.demo).toBeUndefined();
    expect(stale).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("reuses old data for failed current members, marked stale, and never for departed ones", () => {
    const previous: Snapshot = {
      syncedAt: "2026-09-01T00:00:00Z",
      memberCount: 3,
      players: [
        { allyCode: 2, name: "alice", units: { GLREY: { g: 13, r: 3, s: 7 } } },
        { allyCode: 9, name: "Gone", units: {} },
      ],
    };
    const { snapshot, stale, missing } = buildSnapshot(
      guild([[1, "Bob"], [2, "alice"], [4, "Newbie"]]),
      [player(1, "Bob", 9)],
      wanted,
      "2026-10-01T00:00:00Z",
      previous,
    );
    expect(snapshot.players.map((p) => [p.name, p.stale ?? false])).toEqual([
      ["alice", true],
      ["Bob", false],
    ]);
    expect(stale).toEqual([{ allyCode: 2, name: "alice" }]);
    expect(missing).toEqual([{ allyCode: 4, name: "Newbie" }]);
    expect(snapshot.memberCount).toBe(3);
  });
});
