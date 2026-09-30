import { describe, expect, it } from "vitest";
import { phasePlanSentence, unitPlanSentence } from "./format";
import { allocateUnit, missingSlots, phasePlan, planetOrder } from "./plan";
import { phaseRequirements } from "./status";
import { requirements } from "./test-data";

const DS = "Mustafar";
const MX = "Corellia";
const LS = "Coruscant";
const BONUS = "Zeffo";
const ORDER = [DS, MX, LS];
const unit = (baseId: string, meets: number, planets: Record<string, number>) => ({
  baseId,
  meets,
  planets: Object.entries(planets).map(([planet, required]) => ({ planet, required })),
});

describe("allocateUnit", () => {
  it("fills focus planets first, then the rest in display order", () => {
    expect(allocateUnit(unit("A", 7, { [DS]: 7, [MX]: 5 }).planets, 7, [MX], ORDER)).toEqual([
      { planet: DS, required: 7, placed: 2, focus: false },
      { planet: MX, required: 5, placed: 5, focus: true },
      { planet: LS, required: 0, placed: 0, focus: false },
    ]);
  });
});

describe("phasePlan", () => {
  it("picks the largest set of planets that can be filled completely", () => {
    // A is shared: 4 players cover DS 2 + LS 2, but not Mixed 3 as well.
    const units = [unit("A", 4, { [DS]: 2, [MX]: 3, [LS]: 2 }), unit("B", 9, { [DS]: 1, [MX]: 1, [LS]: 1 })];
    expect(missingSlots(units, [DS, LS])).toBe(0);
    expect(missingSlots(units, [DS, MX, LS])).toBe(3);
    const plan = phasePlan(units, ORDER);
    expect(plan.complete).toBe(true);
    expect(plan.focus).toEqual([DS, LS]);
    expect(plan.planets.find((p) => p.planet === MX)).toMatchObject({ slots: 4, filled: 1, focus: false });
  });

  it("breaks ties by leaving the other planet closest to full", () => {
    const units = [unit("A", 3, { [DS]: 1, [LS]: 3 }), unit("B", 3, { [DS]: 3, [LS]: 3 })];
    const plan = phasePlan(units, ORDER);
    expect(plan.focus).toEqual([DS]);
    expect(plan.planets.find((p) => p.planet === LS)!.filled).toBe(2);
  });

  it("falls back to the planet with the fewest empty slots", () => {
    const units = [unit("A", 0, { [DS]: 2, [LS]: 1 }), unit("B", 5, { [DS]: 5, [LS]: 1 }), unit("C", 0, { [LS]: 3 })];
    const plan = phasePlan(units, ORDER);
    expect(plan.complete).toBe(false);
    expect(plan.focus).toEqual([DS]);
    expect(phasePlanSentence(plan)).toBe(
      "No planet can be filled completely yet. Closest is Mustafar: 2 of 7 slots still empty.",
    );
  });

  it("treats a bonus planet as its own planet, even with the same alignment", () => {
    // Kashyyyk (LS) and Zeffo (bonus, LS) compete for the same 3 players of A.
    const order = ["Kashyyyk", BONUS];
    const units = [unit("A", 3, { Kashyyyk: 2, [BONUS]: 2 }), unit("B", 9, { Kashyyyk: 1, [BONUS]: 1 })];
    const plan = phasePlan(units, order);
    expect(plan.planets.map((p) => p.planet)).toEqual(["Kashyyyk", BONUS]);
    expect(plan.focus).toHaveLength(1);
  });

  it("describes the plan in plain words", () => {
    const units = [unit("A", 4, { [DS]: 2, [MX]: 3, [LS]: 2 }), unit("B", 9, { [DS]: 1, [MX]: 1, [LS]: 1 })];
    expect(phasePlanSentence(phasePlan(units, ORDER))).toBe(
      "Focus on Mustafar and Coruscant: they can be filled completely. After that, Corellia 3 short.",
    );
    expect(phasePlanSentence(phasePlan([unit("A", 9, { [DS]: 2, [LS]: 2 })], ORDER))).toBe(
      "Every planet can be filled completely.",
    );
  });

  it("fills every real planet, bonus ones included, when everyone meets everything", () => {
    for (const phase of requirements.phases) {
      const everyone = phaseRequirements(phase).map((u) => ({ ...u, meets: 99 }));
      const plan = phasePlan(everyone, planetOrder(phase));
      expect(plan.focus).toEqual(planetOrder(phase));
      expect(plan.planets.every((x) => x.slots === 90 && x.filled === 90)).toBe(true);
    }
  });
});

describe("unitPlanSentence", () => {
  const s = (meets: number, planets: Record<string, number>, focus: string[]) =>
    unitPlanSentence(allocateUnit(unit("X", meets, planets).planets, meets, focus, ORDER));

  it("follows the phase plan", () => {
    expect(s(7, { [DS]: 7, [MX]: 5 }, [DS])).toBe("Covers the focus planet. 5 more needed for Corellia.");
    expect(s(3, { [DS]: 7, [MX]: 5 }, [DS])).toBe("4 short on Mustafar, the focus planet. Gear this unit first.");
    expect(s(12, { [DS]: 7, [MX]: 5 }, [DS])).toBe("Enough for every planet.");
    expect(s(1, { [MX]: 2 }, [DS])).toBe("Not needed on the focus planet. 1 more needed for Corellia.");
  });
});
