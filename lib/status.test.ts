import { describe, expect, it } from "vitest";
import type { Phase } from "./requirements";
import { floorFor, phaseRequirements, phaseStatus, statusFor } from "./status";
import type { TrimmedPlayer } from "./snapshot";
import { requirements } from "./test-data";

describe("statusFor (§5.3)", () => {
  // need = phase total 10 (Darth Traya in P1). Over 2 days, 5 players can fill it.
  it.each([
    [10, "enough"],
    [12, "enough"],
    [9, "days"],
    [5, "days"],
    [4, "short"],
    [0, "short"],
  ] as const)("meets %i of need 10 over 2 days -> %s", (meets, expected) => {
    expect(statusFor(meets, 10, 2)).toBe(expected);
  });

  it("rounds the floor up: 7 slots over 2 days need 4 players", () => {
    expect(floorFor(7, 2)).toBe(4);
    expect(statusFor(4, 7, 2)).toBe("days");
    expect(statusFor(3, 7, 2)).toBe("short");
    expect(floorFor(7, 3)).toBe(3);
    expect(statusFor(3, 7, 3)).toBe("days");
  });

  it("is the old once-per-phase rule with 1 day: nothing between enough and short", () => {
    expect(statusFor(3, 3, 1)).toBe("enough");
    expect(statusFor(2, 3, 1)).toBe("short");
  });
});

const phase: Phase = {
  phase: 3,
  minRelic: 7,
  planets: [
    { name: "DS", alignment: "Dark Side", bonus: false, platoons: [], units: [{ name: "A", required: 3, baseId: "A", combatType: 1 }] },
    {
      name: "MX",
      alignment: "Mixed",
      bonus: false,
      platoons: [],
      units: [
        { name: "A", required: 1, baseId: "A", combatType: 1 },
        { name: "SHIP", required: 2, baseId: "SHIP", combatType: 2 },
      ],
    },
    { name: "LS", alignment: "Light Side", bonus: false, platoons: [], units: [] },
  ],
};

describe("phaseRequirements", () => {
  it("sums planets into the phase total", () => {
    const [a, ship] = phaseRequirements(phase);
    expect(a).toMatchObject({ baseId: "A", need: 4 });
    expect(a.planets).toEqual([
      { planet: "DS", required: 3 },
      { planet: "MX", required: 1 },
    ]);
    expect(ship).toMatchObject({ need: 2, combatType: 2 });
  });

  it("covers the real dataset with need == sum of planets", () => {
    for (const p of requirements.phases) {
      const units = phaseRequirements(p);
      expect(units.reduce((a, u) => a + u.need, 0)).toBe(90 * p.planets.length);
      for (const u of units) expect(u.need).toBe(u.planets.reduce((a, x) => a + x.required, 0));
    }
  });
});

describe("phaseStatus", () => {
  const player = (n: number, units: TrimmedPlayer["units"]): TrimmedPlayer => ({ allyCode: n, name: `p${n}`, units });
  const players = [
    player(1, { A: { g: 13, r: 7, s: 7 }, SHIP: { s: 7 } }),
    player(2, { A: { g: 13, r: 9, s: 7 }, SHIP: { s: 6 } }),
    player(3, { A: { g: 13, r: 6, s: 7 } }),
    player(4, { A: { g: 13, r: 8, s: 7 }, SHIP: { s: 7 } }),
    player(5, {}),
  ];

  it("counts meets and owned per unit, with the phase relic minimum, over 2 days by default", () => {
    const [a, ship] = phaseStatus(phase, players);
    expect(a).toMatchObject({ meets: 3, owned: 4, need: 4, floor: 2, status: "days" });
    expect(ship).toMatchObject({ meets: 2, owned: 3, need: 2, floor: 1, status: "enough" });
  });

  it("takes the days the guild spends on the phase", () => {
    expect(phaseStatus(phase, players, 1)[0]).toMatchObject({ floor: 4, status: "short" });
    expect(phaseStatus(phase, players, 3)[0]).toMatchObject({ floor: 2, status: "days" });
  });

  it("is red when the slots cannot be filled even over the days", () => {
    const [a] = phaseStatus(phase, [player(1, { A: { g: 13, r: 7, s: 7 } })], 2);
    expect(a.status).toBe("short");
    expect(phaseStatus(phase, [], 3)[0]).toMatchObject({ meets: 0, status: "short" });
  });
});
