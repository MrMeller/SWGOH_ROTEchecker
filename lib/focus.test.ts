import { describe, expect, it } from "vitest";
import { focusList, recommendationsFor } from "./focus";
import { DISCORD_LIMIT, focusToDiscord, planSentence } from "./format";
import { planetPlan } from "./status";
import type { Phase } from "./requirements";
import type { TrimmedPlayer } from "./swgoh";

const phase: Phase = {
  phase: 5,
  minRelic: 9,
  planets: [
    {
      alignment: "Dark Side",
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
  const focus = focusList(phase, players);

  it("lists only units below need, with the gap's closest candidates", () => {
    expect(focus.map((f) => f.baseId)).toEqual(["A"]);
    const [a] = focus;
    expect(a.gap).toBe(2);
    expect(a.candidates.map((c) => c.name)).toEqual(["p2", "p3"]);
    expect(a.effort).toBe(1 + 4);
    expect(a.closable).toBe(true);
  });

  it("marks gaps that gearing alone cannot close", () => {
    const [b] = focusList({ ...phase, planets: [{ alignment: "Dark Side", units: [{ name: "B", required: 4, baseId: "B", combatType: 1 }] }] }, players);
    expect(b.gap).toBe(3);
    expect(b.candidates).toHaveLength(1);
    expect(b.closable).toBe(false);
  });
});

describe("recommendationsFor", () => {
  it("returns units where the player is among the closest candidates", () => {
    const focus = focusList(phase, players);
    expect(recommendationsFor(2, focus).map((r) => [r.unit.baseId, r.rank])).toEqual([["A", 1]]);
    expect(recommendationsFor(4, focus)).toEqual([]);
  });
});

describe("planSentence", () => {
  const plan = (planets: [string, number][], meets: number) =>
    planSentence(planetPlan(planets.map(([alignment, required]) => ({ alignment, required })), meets), meets);

  it("explains each case in plain words", () => {
    expect(plan([["Mixed", 1], ["Light Side", 1]], 1)).toBe("Enough for one planet at a time: pick Mixed or LS.");
    expect(plan([["Dark Side", 6], ["Light Side", 1]], 3)).toBe("Enough to fill LS, not DS.");
    expect(plan([["Dark Side", 5], ["Mixed", 1], ["Light Side", 2]], 7)).toBe(
      "Enough to fill DS and LS at the same time, not Mixed as well.",
    );
    expect(plan([["Dark Side", 3], ["Mixed", 2]], 5)).toBe("Enough to fill every planet at the same time.");
    expect(plan([["Mixed", 4]], 4)).toBe("Enough to fill Mixed.");
    expect(plan([["Dark Side", 4], ["Light Side", 3]], 1)).toBe(
      "Not enough for any planet yet. The smallest (LS 3) needs 2 more.",
    );
  });
});

describe("focusToDiscord", () => {
  it("formats one message with no em dashes", () => {
    const [msg, ...rest] = focusToDiscord(5, 9, focusList(phase, players), "2026-10-05T03:00:00Z");
    expect(rest).toEqual([]);
    expect(msg).toContain("**RotE Phase 5 focus** (R9, data from 5 Oct 2026)");
    expect(msg).toContain("**A** 1/3: p2 R8, p3 R5");
    expect(msg).not.toMatch(/—/);
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
