import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { phasePlanSentence, unitPlanSentence } from "./format";
import { allocateUnit, missingSlots, phasePlan } from "./plan";

const DS = "Dark Side";
const MX = "Mixed";
const LS = "Light Side";
const unit = (baseId: string, meets: number, planets: Record<string, number>) => ({
  baseId,
  meets,
  planets: Object.entries(planets).map(([alignment, required]) => ({ alignment, required })),
});

describe("allocateUnit", () => {
  it("fills focus planets first, then the rest in map order", () => {
    expect(allocateUnit(unit("A", 7, { [DS]: 7, [MX]: 5 }).planets, 7, [MX])).toEqual([
      { alignment: DS, required: 7, placed: 2, focus: false },
      { alignment: MX, required: 5, placed: 5, focus: true },
      { alignment: LS, required: 0, placed: 0, focus: false },
    ]);
  });
});

describe("phasePlan", () => {
  it("picks the largest set of planets that can be filled completely", () => {
    // A is shared: 4 players cover DS 2 + LS 2, but not Mixed 3 as well.
    const units = [unit("A", 4, { [DS]: 2, [MX]: 3, [LS]: 2 }), unit("B", 9, { [DS]: 1, [MX]: 1, [LS]: 1 })];
    expect(missingSlots(units, [DS, LS])).toBe(0);
    expect(missingSlots(units, [DS, MX, LS])).toBe(3);
    const plan = phasePlan(units);
    expect(plan.complete).toBe(true);
    // DS+Mixed and Mixed+LS need 5 of A, so DS+LS is the only complete pair.
    expect(plan.focus).toEqual([DS, LS]);
    expect(plan.planets.find((p) => p.alignment === MX)).toMatchObject({ slots: 4, filled: 1, focus: false });
  });

  it("breaks ties by leaving the other planet closest to full", () => {
    // DS and LS can each be filled alone, not both. Filling DS leaves more for LS than the other way round.
    const units = [unit("A", 3, { [DS]: 1, [LS]: 3 }), unit("B", 3, { [DS]: 3, [LS]: 3 })];
    const plan = phasePlan(units);
    expect(plan.focus).toEqual([DS]);
    expect(plan.planets.find((p) => p.alignment === LS)!.filled).toBe(2);
  });

  it("falls back to the planet with the fewest empty slots", () => {
    const units = [unit("A", 0, { [DS]: 2, [LS]: 1 }), unit("B", 5, { [DS]: 5, [LS]: 1 }), unit("C", 0, { [LS]: 3 })];
    const plan = phasePlan(units);
    expect(plan.complete).toBe(false);
    expect(plan.focus).toEqual([DS]);
    expect(phasePlanSentence(plan)).toBe("No planet can be filled completely yet. Closest is DS: 2 of 7 slots still empty.");
  });

  it("describes the plan in plain words", () => {
    const units = [unit("A", 4, { [DS]: 2, [MX]: 3, [LS]: 2 }), unit("B", 9, { [DS]: 1, [MX]: 1, [LS]: 1 })];
    expect(phasePlanSentence(phasePlan(units))).toBe(
      "Focus on DS and LS: they can be filled completely. After that, Mixed 3 short.",
    );
    expect(phasePlanSentence(phasePlan([unit("A", 9, { [DS]: 2, [LS]: 2 })]))).toBe("Every planet can be filled completely.");
  });

  it("runs on every real phase", () => {
    const req = JSON.parse(readFileSync(path.join(__dirname, "../data/rote-requirements.json"), "utf8"));
    for (const p of req.phases) {
      const units = p.planets.flatMap((pl: { units: { baseId: string }[] }) => pl.units).map((u: { baseId: string }) => u.baseId);
      const everyone = [...new Set<string>(units)].map((id) =>
        unit(
          id,
          99,
          Object.fromEntries(
            p.planets.map((pl: { alignment: string; units: { baseId: string; required: number }[] }) => [
              pl.alignment,
              pl.units.find((u) => u.baseId === id)?.required ?? 0,
            ]),
          ),
        ),
      );
      const plan = phasePlan(everyone);
      expect(plan.focus).toEqual([DS, MX, LS]);
      expect(plan.planets.every((x) => x.slots === 90 && x.filled === 90)).toBe(true);
    }
  });
});

describe("unitPlanSentence", () => {
  const s = (meets: number, planets: Record<string, number>, focus: string[]) =>
    unitPlanSentence(allocateUnit(unit("X", meets, planets).planets, meets, focus));

  it("follows the phase plan", () => {
    expect(s(7, { [DS]: 7, [MX]: 5 }, [DS])).toBe("Covers the focus planet. 5 more needed for Mixed.");
    expect(s(3, { [DS]: 7, [MX]: 5 }, [DS])).toBe("4 short on DS, the focus planet. Gear this unit first.");
    expect(s(12, { [DS]: 7, [MX]: 5 }, [DS])).toBe("Enough for every planet.");
    expect(s(1, { [MX]: 2 }, [DS])).toBe("Not needed on the focus planet. 1 more needed for Mixed.");
  });
});
