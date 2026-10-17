import { describe, expect, it } from "vitest";
import {
  checkMissions,
  evaluateMission,
  keptUnits,
  missionPool,
  missionRequirement,
  missingText,
  missionFocus,
  missionStatus,
  rewardText,
  unlockStatusFor,
  type Mission,
  type MissionData,
} from "./missions";
import type { TrimmedPlayer, TrimmedUnit } from "./snapshot";
import { catalog, platoons, readData } from "./test-data";

const data = JSON.parse(readData("rote-special-missions.json")) as MissionData;
const byId = (id: string) => data.missions.find((m) => m.id === id && m.phase !== 4) ?? data.missions.find((m) => m.id === id)!;
const nightsisters = byId("nightsisters");
const cereAndCal = byId("cere-and-cal");
const mandalorians = byId("mandalorians");
const kessel = byId("qira-and-l3");
const name = (id: string) => catalog.find((u) => u.base_id === id)?.name ?? id;

const r = (relic: number): TrimmedUnit => ({ g: 13, r: relic, s: 7 });
const g = (gear: number): TrimmedUnit => ({ g: gear, s: 7 });
const player = (units: Record<string, TrimmedUnit>, name = "P", allyCode = 1): TrimmedPlayer => ({ allyCode, name, units });

describe("data/rote-special-missions.json", () => {
  it("passes validation: 9 missions on known planets with known units and tags", () => {
    expect(checkMissions(data, platoons, catalog)).toEqual([]);
    expect(data.missions).toHaveLength(9);
  });

  it("rejects an unknown planet, an unknown unit, a unit without the tag and a squad smaller than the named units", () => {
    const bad: MissionData = {
      source: "",
      missions: [
        { ...nightsisters, planet: "Hoth" },
        { ...nightsisters, id: "x", required: ["NOBODY"] },
        { ...nightsisters, id: "y", required: ["GRANDINQUISITOR"] },
        { ...cereAndCal, squad: 1 },
        { ...nightsisters, id: "z", unlocks: { planet: "Hoth", wins: 10 } },
      ],
    };
    const errors = checkMissions(bad, platoons, catalog);
    expect(errors).toContainEqual(expect.stringContaining("no planet Hoth in phase 3"));
    expect(errors).toContainEqual(expect.stringContaining("unknown base_id NOBODY"));
    expect(errors).toContainEqual(expect.stringContaining("GRANDINQUISITOR does not carry the tag Nightsister"));
    expect(errors).toContainEqual(expect.stringContaining("squad 1 is smaller than the named units"));
    expect(errors).toContainEqual(expect.stringContaining("Hoth, which is not a bonus planet"));
  });
});

describe("missionPool", () => {
  it("is the tag's characters for a tagged squad", () => {
    const pool = missionPool(nightsisters, catalog);
    expect(pool).toHaveLength(14);
    expect(pool).toContain("MERRIN");
    expect(pool).toContain("MOTHERTALZIN");
  });

  it("is only the named units when the squad is the named units", () => {
    expect(missionPool(cereAndCal, catalog).sort()).toEqual(["CALKESTIS", "CEREJUNDA", "JEDIKNIGHTCAL"]);
  });

  it("is every character when any character counts", () => {
    const pool = missionPool(kessel, catalog);
    expect(pool.length).toBe(catalog.filter((u) => u.combat_type === 1).length);
    expect(pool).toContain("QIRA");
    expect(pool).not.toContain("CAPITALCHIMAERA");
  });

  it("keptUnits adds the mission units to the platoon units for the sync", () => {
    const kept = keptUnits(platoons, data, catalog);
    for (const id of ["SAWGERRERA", "CALKESTIS", "JEDIKNIGHTCAL", "MANDALORBOKATAN", "THIRDSISTER", "DARTHTRAYA", "CAPITALCHIMAERA"]) {
      expect(kept.has(id)).toBe(true);
    }
  });
});

describe("evaluateMission", () => {
  const pool = missionPool(nightsisters, catalog);
  const five = { MERRIN: r(7), MOTHERTALZIN: r(8), DAKA: r(7), ASAJVENTRESS: r(9), TALIA: r(7) };

  it("is ready with five Nightsisters at R7 including Merrin", () => {
    const e = evaluateMission(player(five), nightsisters, pool);
    expect(e).toMatchObject({ ready: true, atLevel: 5, missing: 0, effort: 0, fillersNeeded: 0 });
  });

  it("is not ready when Merrin is below the relic, however many others are there", () => {
    const e = evaluateMission(player({ ...five, MERRIN: r(5), NIGHTSISTERZOMBIE: r(7) }), nightsisters, pool);
    expect(e.ready).toBe(false);
    expect(e.named).toEqual([{ baseId: "MERRIN", label: "R5", distance: 2, owned: true, needsStars: false }]);
    expect(e).toMatchObject({ atLevel: 5, fillersNeeded: 0, missing: 1, effort: 2 });
  });

  it("counts Merrin towards the squad once geared: two short means Merrin plus one filler", () => {
    const e = evaluateMission(player({ MERRIN: g(12), MOTHERTALZIN: r(8), DAKA: r(7), ASAJVENTRESS: r(9), TALIA: r(6), NIGHTSISTERZOMBIE: g(11) }), nightsisters, pool);
    expect(e).toMatchObject({ atLevel: 3, fillersNeeded: 1, missing: 2 });
    expect(e.named[0]).toMatchObject({ baseId: "MERRIN", label: "G12", distance: 8 });
    expect(e.fillers.map((f) => f.baseId)).toEqual(["TALIA"]);
    expect(e.effort).toBe(8 + 1);
  });

  it("charges the whole ladder for fillers the member does not own", () => {
    const e = evaluateMission(player({ MERRIN: r(7) }), nightsisters, pool);
    expect(e).toMatchObject({ atLevel: 1, fillersNeeded: 4, fillers: [], missing: 4, effort: 4 * 20 });
  });

  it("treats a required unit that is not owned as the whole ladder", () => {
    const e = evaluateMission(player({ MOTHERTALZIN: r(8) }), nightsisters, pool);
    expect(e.named).toEqual([{ baseId: "MERRIN", label: "not owned", distance: 20, owned: false, needsStars: true }]);
  });

  it("takes the closest option of an anyOf group", () => {
    const pool2 = missionPool(cereAndCal, catalog);
    const both = evaluateMission(player({ CEREJUNDA: r(7), CALKESTIS: r(5), JEDIKNIGHTCAL: r(6) }), cereAndCal, pool2);
    expect(both.named).toEqual([{ baseId: "JEDIKNIGHTCAL", label: "R6", distance: 1, owned: true, needsStars: false }]);
    expect(both.missing).toBe(1);
    const ready = evaluateMission(player({ CEREJUNDA: r(7), JEDIKNIGHTCAL: r(7) }), cereAndCal, pool2);
    expect(ready.ready).toBe(true);
  });

  it("needs any three Mandalorians with both named ones", () => {
    const pool3 = missionPool(mandalorians, catalog);
    const e = evaluateMission(player({ MANDALORBOKATAN: r(7), THEMANDALORIANBESKARARMOR: r(7), JANGOFETT: r(7) }), mandalorians, pool3);
    expect(e.ready).toBe(true);
    const bokatan = evaluateMission(player({ MANDALORBOKATAN: r(7), THEMANDALORIANBESKARARMOR: r(7), BOKATAN: r(9) }), mandalorians, pool3);
    expect(bokatan.ready).toBe(true);
  });
});

describe("missionStatus", () => {
  const players = [
    player({ MERRIN: r(7), MOTHERTALZIN: r(8), DAKA: r(7), ASAJVENTRESS: r(9), TALIA: r(7) }, "Zed", 1),
    player({ MERRIN: r(7), MOTHERTALZIN: r(8), DAKA: r(7), ASAJVENTRESS: r(9), TALIA: r(7) }, "Amy", 2),
    player({ MERRIN: r(6), MOTHERTALZIN: r(8), DAKA: r(7), ASAJVENTRESS: r(9), TALIA: r(7) }, "Bob", 3),
    player({ MERRIN: r(7), MOTHERTALZIN: r(8) }, "Cid", 4),
    player({}, "Dee", 5),
  ];

  it("splits ready from not ready, closest first, and counts the pool", () => {
    const s = missionStatus(nightsisters, players, catalog);
    expect(s.ready.map((c) => c.name)).toEqual(["Amy", "Zed"]);
    expect(s.notReady.map((c) => [c.name, c.missing])).toEqual([
      ["Bob", 1],
      ["Cid", 3],
      ["Dee", 5],
    ]);
    expect(s.units[0]).toMatchObject({ baseId: "MOTHERTALZIN", atLevel: 4, owned: 4 });
    expect(s.units.find((u) => u.baseId === "MERRIN")).toMatchObject({ named: true, atLevel: 3, owned: 4 });
    expect(s.unlock).toBeUndefined();
    expect(s.uncovered).toEqual([]);
  });

  it("reports the unlock gap and flags named units the snapshot has no entry for", () => {
    const s = missionStatus(mandalorians, players, catalog);
    expect(s.unlock).toEqual({ planet: "Mandalore", wins: 25, status: "short", gap: 25 });
    expect(s.uncovered).toEqual(["MANDALORBOKATAN", "THEMANDALORIANBESKARARMOR"]);
    const cal = missionStatus(cereAndCal, [player({ CALKESTIS: r(7) })], catalog);
    expect(cal.uncovered).toEqual(["CEREJUNDA"]);
  });

  it.each([
    [30, 30, "enough"],
    [31, 30, "enough"],
    [25, 30, "close"],
    [24, 30, "short"],
  ] as const)("%i ready of %i wins -> %s", (ready, wins, expected) => {
    expect(unlockStatusFor(ready, wins)).toBe(expected);
  });
});

describe("text", () => {
  it("writes the requirement as the game shows it", () => {
    expect(missionRequirement(nightsisters, name)).toBe("5 Nightsisters at R7 or higher, including Merrin");
    expect(missionRequirement(cereAndCal, name)).toBe("Cere Junda and Cal Kestis or Jedi Knight Cal Kestis at R7 or higher");
    expect(missionRequirement(mandalorians, name)).toBe("3 Mandalorians at R7 or higher, including Bo-Katan (Mand'alor) and The Mandalorian (Beskar Armor)");
    expect(missionRequirement(kessel, name)).toBe("Any 5 characters at R8 or higher, including Qi'ra and L3-37");
    expect(missionRequirement(byId("clone-troopers"), name)).toBe("5 Clone Troopers at R7 or higher");
    expect(missionRequirement({ ...byId("inquisitorius"), required: [] } as Mission, name)).toBe("5 Inquisitorius at R7 or higher");
  });

  it("writes the reward per win", () => {
    expect(rewardText(nightsisters.reward)).toBe("50 Mk II Guild Event Tokens per win");
    expect(rewardText(byId("inquisitorius").reward)).toBe("1 Third Sister shard per win");
  });
});

describe("missingText", () => {
  const pool = missionPool(nightsisters, catalog);
  it("names the gaps", () => {
    const e = evaluateMission(player({ MERRIN: r(5), MOTHERTALZIN: r(8), DAKA: r(7), ASAJVENTRESS: r(9), TALIA: r(6) }), nightsisters, pool);
    expect(missingText(e, nightsisters, name)).toBe("Merrin R5, 1 more Nightsister (closest Talia R6)");
    const few = evaluateMission(player({ MERRIN: r(7), MOTHERTALZIN: r(8) }), nightsisters, pool);
    expect(missingText(few, nightsisters, name)).toBe("3 more Nightsisters, owns only 0 more");
    expect(missingText(evaluateMission(player({ CEREJUNDA: r(7), CALKESTIS: r(7) }), cereAndCal, missionPool(cereAndCal, catalog)), cereAndCal, name)).toBe("Ready");
  });
});

describe("missionFocus", () => {
  const players = [
    player({ MERRIN: r(7), MOTHERTALZIN: r(8), DAKA: r(7), ASAJVENTRESS: r(9), TALIA: r(7) }, "Amy", 1),
    player({ MERRIN: r(6), MOTHERTALZIN: r(8), DAKA: r(7), ASAJVENTRESS: r(9), TALIA: r(7) }, "Bob", 2),
    player({ MERRIN: r(7), MOTHERTALZIN: r(8) }, "Cid", 3),
    player({}, "Dee", 4),
  ];
  it("lists the closest few when there is nothing to unlock", () => {
    const s = missionStatus(nightsisters, players, catalog);
    expect(missionFocus(s).candidates.map((c) => c.name)).toEqual(["Bob", "Cid", "Dee"]);
    expect(missionFocus(s, 2).candidates.map((c) => c.name)).toEqual(["Bob", "Cid"]);
  });
  it("lists as many members as the unlock gap, none once it is covered", () => {
    const s = missionStatus({ ...mandalorians, unlocks: { planet: "Mandalore", wins: 2 } }, players, catalog);
    expect(s.unlock?.gap).toBe(2);
    expect(missionFocus(s).candidates).toHaveLength(2);
    const covered = { ...s, ready: s.notReady.slice(0, 2), unlock: { ...s.unlock!, gap: 0 } };
    expect(missionFocus(covered).candidates).toEqual([]);
  });
});
