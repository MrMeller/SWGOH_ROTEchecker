import { describe, expect, it } from "vitest";
import type { Phase } from "./requirements";
import { phaseRequirements, phaseStatus, statusFor } from "./status";
import type { TrimmedPlayer } from "./snapshot";
import { requirements } from "./test-data";

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
  it("sums planets into the phase total and tracks the highest planet", () => {
    const [a, ship] = phaseRequirements(phase);
    expect(a).toMatchObject({ baseId: "A", need: 4, maxPlanet: 3 });
    expect(a.planets).toEqual([
      { planet: "DS", required: 3 },
      { planet: "MX", required: 1 },
    ]);
    expect(ship).toMatchObject({ need: 2, maxPlanet: 2, combatType: 2 });
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
