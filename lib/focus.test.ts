import { describe, expect, it } from "vitest";
import { focusList, recommendationsFor } from "./focus";
import { DISCORD_LIMIT, focusToDiscord, gapSentence } from "./format";
import type { Phase } from "./requirements";
import type { TrimmedPlayer } from "./snapshot";

const phase: Phase = {
  phase: 5,
  minRelic: 9,
  planets: [
    {
      name: "Mustafar",
      alignment: "Dark Side",
      bonus: false,
      platoons: [],
      units: [
        { name: "A", required: 3, baseId: "A", combatType: 1 },
        { name: "B", required: 1, baseId: "B", combatType: 1 },
        { name: "S", required: 2, baseId: "S", combatType: 2 },
      ],
    },
  ],
};

const p = (n: number, units: TrimmedPlayer["units"]): TrimmedPlayer => ({ allyCode: n, name: `p${n}`, units });
const players = [
  p(1, { A: { g: 13, r: 9, s: 7 }, B: { g: 13, r: 8, s: 7 }, S: { s: 7 } }),
  p(2, { A: { g: 13, r: 8, s: 7 }, S: { s: 7 } }),
  p(3, { A: { g: 13, r: 5, s: 7 }, B: { g: 13, r: 9, s: 7 } }),
  p(4, { A: { g: 10, s: 7 } }),
];

describe("focusList", () => {
  it("lists only units below need, with the gap's closest candidates (one day)", () => {
    const focus = focusList(phase, players, 1);
    expect(focus.map((f) => f.baseId)).toEqual(["A"]);
    const [a] = focus;
    expect(a).toMatchObject({ status: "short", days: 1, gap: 2, gapDays: 2, closable: true });
    expect(a.candidates.map((c) => c.name)).toEqual(["p2", "p3"]);
    expect(a.effort).toBe(1 + 4);
  });

  it("over 2 days, 1 player meets A of 3 needed: 1 more makes it fillable, 2 more fill day 1", () => {
    const [a] = focusList(phase, players, 2);
    expect(a).toMatchObject({ status: "short", floor: 2, gap: 2, gapDays: 1 });
    expect(a.candidates.map((c) => c.name)).toEqual(["p2", "p3"]);
    // Effort counts the step to the next status: only p2 is needed to fill over 2 days.
    expect(a.effort).toBe(1);
  });

  it("over 3 days, A is already fillable: the gap is to day 1 only", () => {
    const [a] = focusList(phase, players, 3);
    expect(a).toMatchObject({ status: "days", floor: 1, gap: 2, gapDays: 0 });
    expect(a.effort).toBe(1 + 4);
  });

  it("marks gaps that gearing alone cannot close", () => {
    const only = { ...phase, planets: [{ ...phase.planets[0], units: [{ name: "B", required: 4, baseId: "B", combatType: 1 as const }] }] };
    const [b] = focusList(only, players, 1);
    expect(b.gap).toBe(3);
    expect(b.candidates).toHaveLength(1);
    expect(b.closable).toBe(false);
  });
});

describe("recommendationsFor", () => {
  it("returns units where the player is among the closest candidates", () => {
    const focus = focusList(phase, players, 2);
    expect(recommendationsFor(2, focus).map((r) => [r.unit.baseId, r.rank])).toEqual([["A", 1]]);
    expect(recommendationsFor(3, focus).map((r) => [r.unit.baseId, r.rank])).toEqual([["A", 2]]);
    expect(recommendationsFor(4, focus)).toEqual([]);
  });
});

describe("gapSentence", () => {
  it("splits the gap by days", () => {
    expect(gapSentence({ days: 1, gap: 2, gapDays: 2, status: "short" })).toBe("Need 2 more.");
    // One slot: the same player fills it over any number of days.
    expect(gapSentence({ days: 2, gap: 1, gapDays: 1, status: "short" })).toBe("Need 1 more.");
    expect(gapSentence({ days: 2, gap: 2, gapDays: 1, status: "short" })).toBe("Need 1 more to fill it over 2 days, 2 more for day 1.");
    expect(gapSentence({ days: 2, gap: 2, gapDays: 0, status: "days" })).toBe("Fills over 2 days. Need 2 more for day 1.");
  });
});

describe("focusToDiscord", () => {
  it("formats one message with no em dashes", () => {
    const [msg, ...rest] = focusToDiscord(5, 9, focusList(phase, players, 1), "2026-10-05T03:00:00Z");
    expect(rest).toEqual([]);
    expect(msg).toContain("**RotE Phase 5 focus** (R9, data from 5 Oct 2026)");
    expect(msg).toContain("**A** 1/3: p2 R8, p3 R5");
    expect(msg).not.toMatch(/—/);
  });

  it("says how many are needed over the days and for day 1", () => {
    const [two] = focusToDiscord(5, 9, focusList(phase, players, 2), "2026-10-05T03:00:00Z");
    expect(two).toContain("(R9, over 2 days, data from 5 Oct 2026)");
    expect(two).toContain("**A** 1/3: need 1 for 2 days, 2 for day 1: p2 R8, p3 R5");
    const [three] = focusToDiscord(5, 9, focusList(phase, players, 3), "2026-10-05T03:00:00Z");
    expect(three).toContain("**A** 1/3: fills over 3 days, 2 more for day 1: p2 R8, p3 R5");
  });

  it("splits long lists under the Discord limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      ...focusList(phase, players)[0],
      name: `UNIT NUMBER ${i} WITH A LONG NAME`,
    }));
    const msgs = focusToDiscord(5, 9, many, "2026-10-05T03:00:00Z");
    expect(msgs.length).toBeGreaterThan(1);
    for (const m of msgs) expect(m.length).toBeLessThanOrEqual(DISCORD_LIMIT);
  });
});
