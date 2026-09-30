import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Requirements } from "./requirements";
import {
  API_KEY_HEADER,
  fetchPlayer,
  relicFromTier,
  trimPlayer,
  USER_AGENT,
  type RawGuildProfile,
  type RawPlayer,
} from "./swgoh";

const fixture = (f: string) => readFileSync(path.join(__dirname, "../data", f), "utf8");
const rawText = fixture("fixtures/player-528558646.json");
const raw: RawPlayer = JSON.parse(rawText);
const guild: RawGuildProfile = JSON.parse(fixture("fixtures/guild-profile.json"));
const req: Requirements = JSON.parse(fixture("rote-requirements.json"));
const wanted = new Set(req.phases.flatMap((p) => p.planets.flatMap((pl) => pl.units.map((u) => u.baseId!))));

const rawUnit = (id: string) => raw.units.find((u) => u.data.base_id === id)!.data;

describe("relic offset (MrMeller fixture)", () => {
  it.each(["GLREY", "SUPREMELEADERKYLOREN", "GLLEIA"])("%s is R7 in game", (id) => {
    const u = rawUnit(id);
    expect(u.gear_level).toBe(13);
    expect(u.relic_tier).toBe(9);
    expect(relicFromTier(u.relic_tier)).toBe(7);
  });

  it("locked relics and ships have no relic", () => {
    expect(relicFromTier(1)).toBeUndefined();
    expect(relicFromTier(2)).toBe(0);
    expect(relicFromTier(null)).toBeUndefined();
  });
});

describe("payload shape", () => {
  it("player units carry the fields we rely on", () => {
    for (const { data: u } of raw.units) {
      expect(typeof u.base_id).toBe("string");
      expect([1, 2]).toContain(u.combat_type);
      expect(u.rarity).toBeGreaterThanOrEqual(1);
      if (u.combat_type === 2) expect(u.relic_tier).toBeNull();
      if (u.combat_type === 1 && u.gear_level < 13) expect(u.relic_tier).toBe(1);
    }
  });

  it("guild profile lists members with ally codes", () => {
    expect(guild.data.members.length).toBe(guild.data.member_count);
    expect(guild.data.members.some((m) => m.ally_code === 528558646 && m.player_name === "MrMeller")).toBe(true);
  });
});

describe("trimPlayer", () => {
  const trimmed = trimPlayer(raw, wanted);

  it("keeps only requirement units and only g/r/s", () => {
    expect(trimmed.allyCode).toBe(528558646);
    expect(trimmed.name).toBe("MrMeller");
    for (const [id, u] of Object.entries(trimmed.units)) {
      expect(wanted.has(id)).toBe(true);
      expect(Object.keys(u).every((k) => ["g", "r", "s"].includes(k))).toBe(true);
    }
    expect(trimmed.units.GLREY).toEqual({ g: 13, r: 7, s: 7 });
    expect(trimmed.units.SUPREMELEADERKYLOREN).toEqual({ g: 13, r: 7, s: 7 });
  });

  it("stores ships as stars only", () => {
    const ship = raw.units.find((u) => u.data.combat_type === 2 && wanted.has(u.data.base_id))!.data;
    expect(trimmed.units[ship.base_id]).toEqual({ s: ship.rarity });
  });

  it("is much smaller than the raw payload", () => {
    const rawBytes = Buffer.byteLength(rawText);
    const trimmedBytes = Buffer.byteLength(JSON.stringify(trimmed));
    console.log(
      `raw ${(rawBytes / 1024).toFixed(0)} KB, trimmed ${(trimmedBytes / 1024).toFixed(1)} KB, ` +
        `${raw.units.length} -> ${Object.keys(trimmed.units).length} units`,
    );
    expect(trimmedBytes).toBeLessThan(rawBytes / 50);
  });
});

describe("http client", () => {
  const respond = (status: number, headers: Record<string, string> = {}) =>
    (async () => new Response("<html>Just a moment...</html>", { status, headers })) as unknown as typeof fetch;

  it("sends the API key and a descriptive User-Agent", async () => {
    let sent: Record<string, string> = {};
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      sent = init?.headers as Record<string, string>;
      return new Response(JSON.stringify(raw), { status: 200 });
    }) as typeof fetch;
    const player = await fetchPlayer(528558646, { apiKey: "test-key", fetchImpl: fakeFetch });
    expect(player.data.name).toBe("MrMeller");
    expect(sent[API_KEY_HEADER]).toBe("test-key");
    expect(sent["User-Agent"]).toBe(USER_AGENT);
  });

  it("explains Cloudflare challenges and rejected keys", async () => {
    await expect(
      fetchPlayer(1, { apiKey: "k", fetchImpl: respond(403, { "cf-mitigated": "challenge" }) }),
    ).rejects.toThrow(/Cloudflare challenge/);
    await expect(fetchPlayer(1, { apiKey: "k", fetchImpl: respond(401) })).rejects.toThrow(/API key/);
    await expect(fetchPlayer(1, { apiKey: "k", fetchImpl: respond(500) })).rejects.toThrow(/HTTP 500/);
  });
});
