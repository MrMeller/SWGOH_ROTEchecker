import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Phase, Requirements } from "./requirements";
import { phaseRequirements, phaseStatus, planetPlan, statusFor, STATUS_COLOUR } from "./status";
import type { TrimmedPlayer } from "./swgoh";

describe("statusFor (§5.3)", () => {
  // need = phase total 10, highest single planet 7 (Darth Traya in P1)
  it.each([
    [10, "enough"],
    [12, "enough"],
    [9, "planet"],
    [7, "planet"],
    [6, "short"],
    [0, "short"],
  ] as const)("meets %i of need 10 / maxPlanet 7 -> %s", (meets, expected) => {
    expect(statusFor(meets, 10, 7)).toBe(expected);
  });

  it("is green when the unit only appears on one planet and is covered", () => {
    expect(statusFor(3, 3, 3)).toBe("enough");
    expect(statusFor(2, 3, 3)).toBe("short");
  });

  it("maps to the sheet colours", () => {
    expect(STATUS_COLOUR).toEqual({ enough: "green", planet: "yellow", short: "red" });
  });
});

const phase: Phase = {
  phase: 3,
  minRelic: 7,
  planets: [
    { alignment: "Dark Side", units: [{ name: "A", required: 3, baseId: "A", combatType: 1 }] },
    {
      alignment: "Mixed",
      units: [
        { name: "A", required: 1, baseId: "A", combatType: 1 },
        { name: "SHIP", required: 2, baseId: "SHIP", combatType: 2 },
      ],
    },
    { alignment: "Light Side", units: [] },
  ],
};

describe("phaseRequirements", () => {
  it("sums planets into the phase total and tracks the highest planet", () => {
    const [a, ship] = phaseRequirements(phase);
    expect(a).toMatchObject({ baseId: "A", need: 4, maxPlanet: 3 });
    expect(a.planets).toEqual([
      { alignment: "Dark Side", required: 3 },
      { alignment: "Mixed", required: 1 },
    ]);
    expect(ship).toMatchObject({ need: 2, maxPlanet: 2, combatType: 2 });
  });

  it("covers the real dataset with need == sum of planets", () => {
    const req: Requirements = JSON.parse(
      readFileSync(path.join(__dirname, "../data/rote-requirements.json"), "utf8"),
    );
    for (const p of req.phases) {
      const units = phaseRequirements(p);
      expect(units.reduce((a, u) => a + u.need, 0)).toBe(90 * 3);
      for (const u of units) expect(u.need).toBe(u.planets.reduce((a, x) => a + x.required, 0));
    }
  });
});

describe("planetPlan", () => {
  const ds = (n: number) => ({ alignment: "Dark Side", required: n });
  const mx = (n: number) => ({ alignment: "Mixed", required: n });
  const ls = (n: number) => ({ alignment: "Light Side", required: n });

  it("always returns planets in map order, with unused planets at 0", () => {
    const plan = planetPlan([ls(1), mx(1)], 1);
    expect(plan.planets.map((p) => [p.alignment, p.required])).toEqual([
      ["Dark Side", 0],
      ["Mixed", 1],
      ["Light Side", 1],
    ]);
    expect(plan.needed).toBe(2);
  });

  it("yellow: each planet alone, but not both (Mixed 1, LS 1, one player)", () => {
    const plan = planetPlan([mx(1), ls(1)], 1);
    expect(plan.planets.filter((p) => p.fillableAlone).map((p) => p.alignment)).toEqual(["Mixed", "Light Side"]);
    expect(plan.maxAtOnce).toBe(1);
    expect(plan.bestPlans).toEqual([["Mixed"], ["Light Side"]]);
  });

  it("red can still fill a small planet (DS 6, LS 1, three players)", () => {
    const plan = planetPlan([ds(6), ls(1)], 3);
    expect(plan.planets.find((p) => p.alignment === "Dark Side")!.fillableAlone).toBe(false);
    expect(plan.planets.find((p) => p.alignment === "Light Side")!.fillableAlone).toBe(true);
    expect(plan.bestPlans).toEqual([["Light Side"]]);
  });

  it("prefers more planets, then more slots", () => {
    // 7 players: DS 5 + LS 2 (2 planets, 7 slots) beats DS 5 + Mixed 1 (2 planets, 6 slots)
    const plan = planetPlan([ds(5), mx(1), ls(2)], 7);
    expect(plan.bestPlans).toEqual([["Dark Side", "Light Side"]]);
    expect(plan.maxAtOnce).toBe(2);
  });

  it("fills everything when meets covers the phase total", () => {
    const plan = planetPlan([ds(3), mx(2), ls(1)], 6);
    expect(plan.maxAtOnce).toBe(3);
    expect(plan.planets.every((p) => p.inBestPlan)).toBe(true);
  });

  it("fills nothing when nobody meets it", () => {
    const plan = planetPlan([ds(2)], 0);
    expect(plan.maxAtOnce).toBe(0);
    expect(plan.bestPlans).toEqual([]);
  });
});

describe("phaseStatus", () => {
  const player = (n: number, units: TrimmedPlayer["units"]): TrimmedPlayer => ({ allyCode: n, name: `p${n}`, units });

  it("counts meets and owned per unit, with the phase relic minimum", () => {
    const players = [
      player(1, { A: { g: 13, r: 7, s: 7 }, SHIP: { s: 7 } }),
      player(2, { A: { g: 13, r: 9, s: 7 }, SHIP: { s: 6 } }),
      player(3, { A: { g: 13, r: 6, s: 7 } }),
      player(4, { A: { g: 13, r: 8, s: 7 }, SHIP: { s: 7 } }),
      player(5, {}),
    ];
    const [a, ship] = phaseStatus(phase, players);
    expect(a).toMatchObject({ meets: 3, owned: 4, need: 4, status: "planet" });
    expect(ship).toMatchObject({ meets: 2, owned: 3, need: 2, status: "enough" });
  });

  it("is red when even the biggest planet cannot be filled", () => {
    const [a] = phaseStatus(phase, [player(1, { A: { g: 13, r: 7, s: 7 } })]);
    expect(a.status).toBe("short");
  });
});
