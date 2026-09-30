import { describe, expect, it } from "vitest";
import { evaluate, ladderStep, ladderTarget, playerListForUnit } from "./matching";
import type { TrimmedPlayer, TrimmedUnit } from "./swgoh";

const char = (g: number, r?: number, s = 7): TrimmedUnit => (r === undefined ? { g, s } : { g, r, s });

describe("progress ladder (§5.1)", () => {
  it("maps gear and relic onto one scale", () => {
    expect(ladderStep(char(1))).toBe(1);
    expect(ladderStep(char(12))).toBe(12);
    expect(ladderStep(char(13, 0))).toBe(13);
    expect(ladderStep(char(13, 10))).toBe(23);
    expect(ladderTarget(5)).toBe(18);
    expect(ladderTarget(9)).toBe(22);
  });

  it("matches the Phase 1 (R5) examples", () => {
    const d = (u: TrimmedUnit) => evaluate(u, 1, 5)!.distance;
    expect(d(char(13, 5))).toBe(0);
    expect(d(char(13, 8))).toBe(0);
    expect(d(char(13, 3))).toBe(2);
    expect(d(char(13, 0))).toBe(5);
    expect(d(char(11))).toBe(7);
  });

  it("meets only at G13 with relic >= phase minimum", () => {
    expect(evaluate(char(13, 9), 1, 9)!.meets).toBe(true);
    expect(evaluate(char(13, 10), 1, 9)!.meets).toBe(true);
    expect(evaluate(char(13, 8), 1, 9)!.meets).toBe(false);
    expect(evaluate(char(12), 1, 5)!.meets).toBe(false);
  });

  it("flags characters below 7 stars", () => {
    const e = evaluate(char(13, undefined, 6), 1, 5)!;
    expect(e).toMatchObject({ meets: false, needsStars: true, distance: 5, label: "G13" });
  });

  it("labels levels as in game", () => {
    expect(evaluate(char(13, 8), 1, 9)!.label).toBe("R8");
    expect(evaluate(char(13, 0), 1, 9)!.label).toBe("R0");
    expect(evaluate(char(12), 1, 9)!.label).toBe("G12");
    expect(evaluate(char(3), 1, 9)!.label).toBe("G3");
  });

  it("returns undefined when not owned", () => {
    expect(evaluate(undefined, 1, 5)).toBeUndefined();
  });
});

describe("ships (§5.2)", () => {
  it("meets at 7 stars, relic and phase do not matter", () => {
    expect(evaluate({ s: 7 }, 2, 9)).toMatchObject({ meets: true, distance: 0, label: "7★" });
    expect(evaluate({ s: 6 }, 2, 5)).toMatchObject({ meets: false, distance: 1, label: "6★" });
    expect(evaluate({ s: 1 }, 2, 5)!.distance).toBe(6);
  });
});

describe("player list for a unit (§5.4)", () => {
  const p = (name: string, units: TrimmedPlayer["units"], allyCode = name.length): TrimmedPlayer => ({
    allyCode,
    name,
    units,
  });
  const players = [
    p("gear1", { X: char(1) }),
    p("r8", { X: char(13, 8) }),
    p("r9", { X: char(13, 9) }),
    p("r10", { X: char(13, 10) }),
    p("g12", { X: char(12) }),
    p("r0", { X: char(13, 0) }),
    p("g13SixStar", { X: char(13, undefined, 6) }),
    p("none", {}),
    p("alsoNone", { Y: char(13, 9) }),
  ];

  it("splits meets / closest / not owned and sorts closest first, gear 1 last", () => {
    const list = playerListForUnit("X", 1, 9, players);
    expect(list.meets.map((c) => c.name).sort()).toEqual(["r10", "r9"]);
    expect(list.closest.map((c) => c.label)).toEqual(["R8", "R0", "G13", "G12", "G1"]);
    expect(list.closest[0].distance).toBe(1);
    expect(list.closest.at(-1)!.name).toBe("gear1");
    expect(list.notOwned).toBe(2);
  });

  it("puts needs-stars players after 7-star players at equal distance", () => {
    const list = playerListForUnit("X", 1, 9, players);
    const r0 = list.closest.findIndex((c) => c.name === "r0");
    const sixStar = list.closest.findIndex((c) => c.name === "g13SixStar");
    expect(list.closest[r0].distance).toBe(list.closest[sixStar].distance);
    expect(r0).toBeLessThan(sixStar);
  });

  it("sorts ships by stars", () => {
    const ships = [p("a", { S: { s: 5 } }), p("b", { S: { s: 7 } }), p("c", { S: { s: 6 } })];
    const list = playerListForUnit("S", 2, 9, ships);
    expect(list.meets.map((c) => c.name)).toEqual(["b"]);
    expect(list.closest.map((c) => c.label)).toEqual(["6★", "5★"]);
  });

  it("carries the stale flag through", () => {
    const list = playerListForUnit("X", 1, 5, [{ ...p("old", { X: char(13, 5) }), stale: true }]);
    expect(list.meets[0].stale).toBe(true);
  });
});
