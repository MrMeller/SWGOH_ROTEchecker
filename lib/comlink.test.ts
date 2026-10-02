import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  baseIdOf,
  ComlinkError,
  fetchGuild,
  fetchPlayer,
  relicFromTier,
  trimPlayer,
  USER_AGENT,
  type ComlinkGuild,
  type ComlinkPlayer,
} from "./comlink";
import { wantedUnits } from "./requirements";
import { catalog, platoons } from "./test-data";

// Reduced real responses from the 2026-10-02 smoke test (fields and required units only).
const fixture = (f: string) => readFileSync(path.join(__dirname, "../data/fixtures", f), "utf8");
const raw: ComlinkPlayer = JSON.parse(fixture("comlink-player-528558646.json"));
const guild: ComlinkGuild = JSON.parse(fixture("comlink-guild.json"));
const wanted = wantedUnits(platoons);
const ships = new Set(catalog.filter((u) => u.combat_type === 2).map((u) => u.base_id));
const known = new Set(catalog.map((u) => u.base_id));

const rawUnit = (id: string) => raw.rosterUnit.find((u) => baseIdOf(u.definitionId) === id)!;

describe("relic offset (MrMeller fixture)", () => {
  it.each(["GLREY", "SUPREMELEADERKYLOREN", "GLLEIA"])("%s is R7 in game", (id) => {
    const u = rawUnit(id);
    expect(u.currentTier).toBe(13);
    expect(u.relic?.currentTier).toBe(9);
    expect(relicFromTier(u.relic?.currentTier)).toBe(7);
  });

  it("locked relics and ships have no relic", () => {
    expect(relicFromTier(1)).toBeUndefined();
    expect(relicFromTier(2)).toBe(0);
    expect(relicFromTier(null)).toBeUndefined();
  });
});

describe("payload shape", () => {
  it("every roster unit has a known base_id before the colon and the fields we rely on", () => {
    for (const u of raw.rosterUnit) {
      expect(u.definitionId).toMatch(/^[A-Z0-9_]+:[A-Z_]+$/);
      expect(known.has(baseIdOf(u.definitionId))).toBe(true);
      expect(u.currentRarity).toBeGreaterThanOrEqual(1);
      expect(u.currentTier).toBeGreaterThanOrEqual(1);
      const id = baseIdOf(u.definitionId);
      if (ships.has(id)) expect(u.relic).toBeNull();
      else if (u.currentTier < 13) expect(u.relic?.currentTier).toBe(1);
    }
  });

  it("the player carries ally code (as a string), player id and name", () => {
    expect(raw.allyCode).toBe("528558646");
    expect(raw.playerId).toBe("7bPGpb2VSf6xaD-tEtyQNw");
    expect(raw.name).toBe("MrMeller");
  });

  it("the guild roster lists members by player id without ally codes", () => {
    const { profile, member } = guild.guild;
    expect(profile.id).toBe("7JSQexIuSQeSTz94gaRsew");
    expect(member.length).toBe(profile.memberCount);
    const me = member.find((m) => m.playerName === "MrMeller")!;
    expect(me.playerId).toBe(raw.playerId);
    expect("allyCode" in me).toBe(false);
  });
});

describe("trimPlayer", () => {
  const trimmed = trimPlayer(raw, wanted, ships);

  it("keeps only requirement units and only g/r/s", () => {
    expect(trimmed.allyCode).toBe(528558646);
    expect(trimmed.playerId).toBe(raw.playerId);
    expect(trimmed.name).toBe("MrMeller");
    expect(Object.keys(trimmed.units).length).toBe(266);
    for (const [id, u] of Object.entries(trimmed.units)) {
      expect(wanted.has(id)).toBe(true);
      expect(Object.keys(u).every((k) => ["g", "r", "s"].includes(k))).toBe(true);
    }
    expect(trimmed.units.GLREY).toEqual({ g: 13, r: 7, s: 7 });
    expect(trimmed.units.DARTHTRAYA).toEqual({ g: 13, r: 3, s: 7 });
    expect(trimmed.units.MAUL).toEqual({ g: 9, s: 7 });
  });

  it("stores ships as stars only", () => {
    expect(trimmed.units.CAPITALSTARDESTROYER).toEqual({ s: 7 });
    expect(trimmed.units.UWINGSCARIF).toEqual({ s: 7 });
  });

  it("drops the relic for characters below G13", () => {
    const u = { definitionId: "X:SEVEN_STAR", currentRarity: 7, currentTier: 12, relic: { currentTier: 5 } };
    const t = trimPlayer({ name: "n", allyCode: "1", playerId: "p", rosterUnit: [u] }, new Set(["X"]), new Set());
    expect(t.units.X).toEqual({ g: 12, s: 7 });
  });
});

describe("http client", () => {
  it("posts the comlink request body with a descriptive User-Agent", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init: init! });
      return Response.json(url.endsWith("/guild") ? guild : raw);
    }) as typeof fetch;

    const g = await fetchGuild("GID", { baseUrl: "http://comlink:3000/", fetchImpl: fakeFetch });
    const p = await fetchPlayer("PID", { fetchImpl: fakeFetch });
    expect(g.guild.profile.name).toBe("DutchJedi");
    expect(p.name).toBe("MrMeller");

    expect(calls.map((c) => c.url)).toEqual(["http://comlink:3000/guild", "http://localhost:3000/player"]);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      payload: { guildId: "GID", includeRecentGuildActivityInfo: true },
      enums: false,
    });
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ payload: { playerId: "PID" }, enums: false });
    expect((calls[0].init.headers as Record<string, string>)["User-Agent"]).toBe(USER_AGENT);
  });

  it("explains comlink error bodies and unreachable hosts", async () => {
    const respond = (status: number, body: string) => (async () => new Response(body, { status })) as unknown as typeof fetch;
    await expect(fetchPlayer("x", { fetchImpl: respond(400, '{"code":32,"message":"Record not found"}') })).rejects.toThrow(
      /HTTP 400 .*record not found.*Record not found/,
    );
    const rate = fetchPlayer("x", { fetchImpl: respond(429, '{"code":6,"message":"RATEEXCEEDED"}') });
    await expect(rate).rejects.toBeInstanceOf(ComlinkError);
    await expect(rate).rejects.toMatchObject({ status: 429, code: 6 });
    await expect(fetchPlayer("x", { fetchImpl: respond(500, "<html>") })).rejects.toThrow(/HTTP 500/);
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(fetchGuild("g", { fetchImpl: down })).rejects.toThrow(/Cannot reach comlink/);
  });
});
