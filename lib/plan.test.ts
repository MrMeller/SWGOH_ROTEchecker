import { describe, expect, it } from "vitest";
import { laterDays, phasePlanSentence, unitPlanSentence } from "./format";
import { maxPlatoons, phasePlan, platoonViews, sparePlacements, unitAllocation } from "./plan";
import type { Phase, Planet } from "./requirements";
import type { Snapshot } from "./snapshot";
import { phaseStatus } from "./status";
import { readData, requirements } from "./test-data";

const demand = (ids: string[]) => ids.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<string, number>());
const supply = (o: Record<string, number>) => new Map(Object.entries(o));

const planet = (name: string, platoons: string[][], bonus = false): Planet => ({
  name,
  alignment: "Light Side",
  bonus,
  units: [],
  platoons,
});
const phase = (...planets: Planet[]): Phase => ({ phase: 1, minRelic: 5, planets });

describe("maxPlatoons", () => {
  it("finds the true maximum, not just the greedy pick", () => {
    // Greedy takes the first platoon (A x2) and is stuck at 1; two A x1 platoons fit together.
    const r = maxPlatoons([demand(["A", "A"]), demand(["A"]), demand(["A"])], supply({ A: 2 }));
    expect(r).toEqual({ chosen: [1, 2], exact: true });
  });

  it("takes everything when everything fits, and nothing when a unit is missing", () => {
    expect(maxPlatoons([demand(["A"]), demand(["B"])], supply({ A: 1, B: 1 })).chosen).toEqual([0, 1]);
    expect(maxPlatoons([demand(["A", "C"])], supply({ A: 5 })).chosen).toEqual([]);
  });

  it("keeps the earlier platoons on a tie", () => {
    expect(maxPlatoons([demand(["A"]), demand(["A"]), demand(["A"])], supply({ A: 2 })).chosen).toEqual([0, 1]);
  });

  it("reports when it stops at the node limit", () => {
    const r = maxPlatoons([demand(["A", "A"]), demand(["A"]), demand(["A"])], supply({ A: 2 }), 1);
    expect(r.exact).toBe(false);
    expect(r.chosen).toEqual([0]);
  });
});

describe("phasePlan over one day (once per phase)", () => {
  it("marks planned platoons per planet and counts the slots each unit fills", () => {
    const p = phase(planet("Kashyyyk", [["A", "B"], ["A", "C"], ["D"]]), planet("Zeffo", [["A"], ["B"]], true));
    const plan = phasePlan(p, supply({ A: 2, B: 1, C: 1 }), 1);
    expect(plan.total).toBe(5);
    // Nobody meets D, so Kashyyyk 3 stays open. With 2 A and 1 B, filling Kashyyyk 1 and 2
    // gives 2 platoons; Kashyyyk 2 plus both Zeffo platoons gives 3, so the plan takes that.
    expect(plan.planets).toEqual([
      { planet: "Kashyyyk", platoons: [false, "day1", false], filled: 1, firstDay: 1 },
      { planet: "Zeffo", platoons: ["day1", "day1"], filled: 2, firstDay: 2 },
    ]);
    expect(plan).toMatchObject({ days: 1, filled: 3, firstDay: 3 });
    expect(plan.planned.get("A")).toEqual(new Map([["Kashyyyk", 1], ["Zeffo", 1]]));
  });

  it("prefers regular planets over bonus planets on a tie", () => {
    const plan = phasePlan(phase(planet("Zeffo", [["A"]], true), planet("Kashyyyk", [["A"]])), supply({ A: 1 }), 1);
    expect(plan.planets.find((x) => x.planet === "Kashyyyk")!.filled).toBe(1);
    expect(plan.planets.find((x) => x.planet === "Zeffo")!.filled).toBe(0);
  });

  it("fills every real platoon when everyone meets everything, and none when nobody does", () => {
    for (const p of requirements.phases) {
      const ids = new Set(p.planets.flatMap((pl) => pl.platoons.flat()));
      const all = phasePlan(p, new Map([...ids].map((id) => [id, 99])), 1);
      expect(all.filled).toBe(all.total);
      expect(all.firstDay).toBe(all.total);
      expect(all.total).toBe(p.planets.length * 6);
      expect(phasePlan(p, new Map(), 1).filled).toBe(0);
    }
  });
});

describe("phasePlan over several days", () => {
  // One A, one B. Day 1 fills one of the A platoons. Day 2 the same player places A again.
  const p = phase(planet("Kessel", [["A", "B"], ["A"], ["A", "A"]]));

  it("keeps the day-1 plan and extends it with repeat placements", () => {
    const plan = phasePlan(p, supply({ A: 1, B: 1 }), 2);
    // Day 1: Kessel 2 (A alone has the least pressure). Then 1 A left for Kessel 1.
    expect(plan.planets[0]).toEqual({ planet: "Kessel", platoons: ["later", "day1", false], filled: 2, firstDay: 2 - 1 });
    expect(plan).toMatchObject({ days: 2, filled: 2, firstDay: 1, exact: true });
    expect(plan.planned.get("A")).toEqual(new Map([["Kessel", 2]]));
  });

  it("gives every unit meets × days placements", () => {
    const three = phasePlan(p, supply({ A: 1, B: 1 }), 3);
    expect(three.filled).toBe(2); // 3 A placements: Kessel 1 + 2 use 2, Kessel 3 needs 2 more
    const four = phasePlan(p, supply({ A: 2, B: 1 }), 2);
    expect(four.filled).toBe(3);
    expect(four.firstDay).toBe(2);
    expect(sparePlacements(four, "A", 2)).toBe(0);
    expect(sparePlacements(four, "B", 1)).toBe(1);
  });

  it("solves every real phase exactly on the demo roster, quickly, for 1 to 3 days", () => {
    const snapshot = JSON.parse(readData("snapshots/demo.json")) as Snapshot;
    for (const p of requirements.phases) {
      const meets = new Map(phaseStatus(p, snapshot.players).map((u) => [u.baseId, u.meets]));
      let previous = -1;
      for (const days of [1, 2, 3]) {
        const started = Date.now();
        const plan = phasePlan(p, meets, days);
        expect(plan.exact, `P${p.phase} ${days}d`).toBe(true);
        expect(Date.now() - started, `P${p.phase} ${days}d ms`).toBeLessThan(2000);
        // More days never fill fewer platoons, and day 1 is the same plan as 1 day.
        expect(plan.filled).toBeGreaterThanOrEqual(previous);
        expect(plan.firstDay).toBe(phasePlan(p, meets, 1).filled);
        previous = plan.filled;
        // The planned platoons never need more placements than meets × days.
        for (const [id, perPlanet] of plan.planned) {
          expect([...perPlanet.values()].reduce((a, n) => a + n, 0)).toBeLessThanOrEqual((meets.get(id) ?? 0) * days);
        }
      }
    }
  });
});

describe("unitAllocation", () => {
  const p = phase(planet("Kessel", [["A", "A", "B"], ["A", "C"], ["B"]]), planet("Lothal", [["A"]]));

  it("shows the platoons a unit is in, what the plan fills, and what it is short for", () => {
    // Nobody meets C, so Kessel 2 stays open. The plan fills Kessel 1 and 3 and Lothal,
    // using all 3 A: none spare for Kessel 2, so A is short for it as well.
    const plan = phasePlan(p, supply({ A: 3, B: 2 }), 1);
    expect(unitAllocation(p, plan, "A", 3)).toEqual([
      { planet: "Kessel", required: 3, planned: 2, platoons: ["day1", false, undefined], shortFor: 1 },
      { planet: "Lothal", required: 1, planned: 1, platoons: ["day1"], shortFor: 0 },
    ]);
    // With a fourth A there is one spare, so only C holds Kessel 2 back.
    const roomy = phasePlan(p, supply({ A: 4, B: 2 }), 1);
    expect(unitAllocation(p, roomy, "A", 4)[0].shortFor).toBe(0);
    // Over 2 days the 3 A give 6 placements, 3 planned: A is no longer short for Kessel 2.
    const twoDays = phasePlan(p, supply({ A: 3, B: 2 }), 2);
    expect(unitAllocation(p, twoDays, "A", 3)[0].shortFor).toBe(0);
  });

  it("describes the unit and the phase in plain words", () => {
    const plan = phasePlan(p, supply({ A: 3, B: 2 }), 1);
    expect(phasePlanSentence(plan)).toBe("3 of 4 platoons can be filled at the same time: Kessel 2 and Lothal 1.");
    expect(unitPlanSentence(unitAllocation(p, plan, "B", 2))).toBe("Enough for every platoon it is in.");
    expect(unitPlanSentence(unitAllocation(p, plan, "A", 3))).toBe(
      "Short for 1 platoon on Kessel. Gearing this unit opens them up, if their other units are covered.",
    );
    const roomy = phasePlan(p, supply({ A: 4, B: 2 }), 1);
    expect(unitPlanSentence(unitAllocation(p, roomy, "A", 4))).toBe(
      "Enough for every platoon the plan fills. Other units hold its open platoons back.",
    );
    const tight = phasePlan(p, supply({ A: 1, B: 2 }), 1);
    expect(unitPlanSentence(unitAllocation(p, tight, "A", 1))).toMatch(/^Short for \d platoons? on /);
    expect(phasePlanSentence(phasePlan(p, new Map(), 1))).toBe("No platoon can be filled completely yet.");
  });

  it("names the days after day 1 by the toggle", () => {
    expect(laterDays(2)).toBe("day 2");
    expect(laterDays(3)).toBe("day 2 or 3");
  });

  it("says how many platoons wait for a later day", () => {
    const q = phase(planet("Kessel", [["A", "B"], ["A"], ["A", "A"]]));
    expect(phasePlanSentence(phasePlan(q, supply({ A: 1, B: 1 }), 2))).toBe(
      "2 of 3 platoons can be filled over 2 days, 1 on day 1: Kessel 2.",
    );
    expect(phasePlanSentence(phasePlan(q, supply({ A: 2, B: 1 }), 2))).toBe("Every platoon can be filled (3 of 3, 2 on day 1).");
    expect(phasePlanSentence(phasePlan(q, supply({ A: 4, B: 1 }), 2))).toBe("Every platoon can be filled (3 of 3).");
  });
});

describe("platoonViews", () => {
  const p = phase(planet("Kessel", [["A", "A", "B"], ["A", "C"], ["B"]]), planet("Lothal", [["A"]]));

  it("marks filled platoons, lacking units and held slots", () => {
    // 3 A, 2 B, no C: the plan fills Kessel 1 and 3 and Lothal. Kessel 2 is open: C is
    // missing, and A has no spare player left, so both count as lacking.
    const plan = phasePlan(p, supply({ A: 3, B: 2 }), 1);
    const views = platoonViews(p, plan, "Kessel", supply({ A: 3, B: 2 }));
    expect(views.map((v) => [v.number, v.fill])).toEqual([
      [1, "day1"],
      [2, false],
      [3, "day1"],
    ]);
    expect(views[0].slots.every((s) => s.state === "filled")).toBe(true);
    expect(views[1].slots).toEqual([
      { baseId: "A", state: "lacking" },
      { baseId: "C", state: "lacking" },
    ]);
    expect(views[1].lacking).toEqual(new Map([["A", 1], ["C", 1]]));
  });

  it("shows held slots when every unit is available but used elsewhere", () => {
    // 2 A only: Kessel 1 (A x2) or Kessel 2 + Lothal. Plan takes the pair; Kessel 1 is held.
    const meets = supply({ A: 2, B: 2, C: 1 });
    const views = platoonViews(p, phasePlan(p, meets, 1), "Kessel", meets);
    expect(views[0].fill).toBe(false);
    expect(views[0].slots.map((s) => s.state)).toEqual(["lacking", "lacking", "held"]);
    expect(views[1].fill).toBe("day1");
  });

  it("rings only the slots we are short for when a spare player covers some", () => {
    // 2 A: the plan fills platoon 2 (A x1), leaving 1 spare. Platoon 1 needs A x3: 2 short.
    const q = phase(planet("Corellia", [["A", "A", "A", "B"], ["A"]]));
    const meets = supply({ A: 2, B: 1 });
    const [open, filled] = platoonViews(q, phasePlan(q, meets, 1), "Corellia", meets);
    expect(filled.fill).toBe("day1");
    expect(open.slots.map((s) => s.state)).toEqual(["held", "lacking", "lacking", "held"]);
    expect(open.lacking).toEqual(new Map([["A", 2]]));
  });

  it("marks the units a player places again in a platoon that fills on a later day", () => {
    // 1 A, 1 B over 2 days: Kessel 2 fills on day 1, Kessel 1 on day 2 with the same A. B is
    // placed once, so only the A slot is scarce. Kessel 3 (A x2) stays open: no A left.
    const q = phase(planet("Kessel", [["A", "B"], ["A"], ["A", "A"]]));
    const meets = supply({ A: 1, B: 1 });
    const [one, two, three] = platoonViews(q, phasePlan(q, meets, 2), "Kessel", meets);
    expect(two.fill).toBe("day1");
    expect(two.slots).toEqual([{ baseId: "A", state: "filled" }]);
    expect(one.fill).toBe("later");
    expect(one.slots).toEqual([
      { baseId: "A", state: "scarce" },
      { baseId: "B", state: "filled" },
    ]);
    expect(three.fill).toBe(false);
    expect(three.slots.map((s) => s.state)).toEqual(["lacking", "lacking"]);
    expect(three.lacking).toEqual(new Map([["A", 2]]));
  });

  it("rejects an unknown planet", () => {
    expect(() => platoonViews(p, phasePlan(p, new Map()), "Nowhere", new Map())).toThrow(/No planet Nowhere/);
  });
});
