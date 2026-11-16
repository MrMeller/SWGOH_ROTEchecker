import { describe, expect, it } from "vitest";
import { filterUnits, matchesQuery, shortfall, unitHref, type UnitFilter, type UnitIndexRow } from "./units";

const st = (s: "enough" | "days" | "short") => ({ 1: s, 2: s, 3: s }) as const;

const rows: UnitIndexRow[] = [
  {
    baseId: "GLREY",
    name: "Rey",
    combatType: 1,
    alignment: "Light Side",
    tags: ["Resistance", "Galactic Legend"],
    phases: [{ phase: 6, minRelic: 9, need: 4, meets: 0, status: st("short") }],
    missions: [],
  },
  {
    baseId: "BOKATAN",
    name: "Bo-Katan Kryze",
    combatType: 1,
    alignment: "Light Side",
    tags: ["Mandalorian"],
    phases: [
      { phase: 3, minRelic: 7, need: 6, meets: 6, status: st("enough") },
      { phase: 4, minRelic: 8, need: 8, meets: 5, status: { 1: "short", 2: "days", 3: "days" } },
    ],
    missions: [{ phase: 3, planet: "Tatooine", title: "Mandalorians", key: "3-mandalorians", minRelic: 7, named: false, meets: 9 }],
  },
  {
    baseId: "TIEFIGHTERIMPERIAL",
    name: "Imperial TIE Fighter",
    combatType: 2,
    alignment: "Dark Side",
    tags: ["Empire"],
    phases: [{ phase: 1, minRelic: 5, need: 10, meets: 30, status: st("enough") }],
    missions: [],
  },
  {
    baseId: "MANDALORBOKATAN",
    name: "Bo-Katan (Mand'alor)",
    combatType: 1,
    alignment: "Light Side",
    tags: ["Mandalorian"],
    phases: [],
    missions: [{ phase: 3, planet: "Tatooine", title: "Mandalorians", key: "3-mandalorians", minRelic: 7, named: true, meets: 4 }],
  },
];

const base: UnitFilter = { query: "", type: "all", usedIn: "all", phase: 0, alignment: "", tag: "", status: "all", days: 2 };
const ids = (f: Partial<UnitFilter>, sort?: "name" | "need") => filterUnits(rows, { ...base, ...f }, sort).map((r) => r.baseId);

describe("unit index filters", () => {
  it("lists everything sorted by name by default", () => {
    expect(ids({})).toEqual(["MANDALORBOKATAN", "BOKATAN", "TIEFIGHTERIMPERIAL", "GLREY"]);
  });

  it("searches name, base_id and tags, ignoring case and accents, every word must match", () => {
    expect(matchesQuery(rows[1], "mandalor")).toBe(true);
    expect(matchesQuery(rows[0], "glrey")).toBe(true);
    expect(matchesQuery(rows[0], "galactic legend")).toBe(true);
    expect(matchesQuery(rows[0], "rey empire")).toBe(false);
    expect(ids({ query: "RÉY" })).toEqual(["GLREY"]);
  });

  it("filters by type, alignment, tag and phase, counting mission phases", () => {
    expect(ids({ type: "ship" })).toEqual(["TIEFIGHTERIMPERIAL"]);
    expect(ids({ type: "character", alignment: "Light Side" })).toEqual(["MANDALORBOKATAN", "BOKATAN", "GLREY"]);
    expect(ids({ tag: "Mandalorian" })).toEqual(["MANDALORBOKATAN", "BOKATAN"]);
    expect(ids({ phase: 6 })).toEqual(["GLREY"]);
    expect(ids({ phase: 3 })).toEqual(["MANDALORBOKATAN", "BOKATAN"]);
    expect(ids({ phase: 2 })).toEqual([]);
  });

  it("filters on platoons or special missions", () => {
    expect(ids({ usedIn: "missions" })).toEqual(["MANDALORBOKATAN", "BOKATAN"]);
    expect(ids({ usedIn: "platoons" })).toEqual(["BOKATAN", "TIEFIGHTERIMPERIAL", "GLREY"]);
    expect(ids({ usedIn: "platoons", phase: 3 })).toEqual(["BOKATAN"]);
    expect(ids({ usedIn: "missions", phase: 4 })).toEqual([]);
  });

  it("filters by platoon status for the chosen days, within the phase in scope", () => {
    expect(ids({ status: "short", days: 1 })).toEqual(["BOKATAN", "GLREY"]);
    expect(ids({ status: "short", days: 2 })).toEqual(["GLREY"]);
    expect(ids({ status: "notEnough", days: 2 })).toEqual(["BOKATAN", "GLREY"]);
    expect(ids({ status: "notEnough", phase: 3 })).toEqual([]);
  });

  it("sorts by uncovered platoon slots, most first", () => {
    expect(shortfall(rows[1], 0)).toBe(3);
    expect(shortfall(rows[3], 0)).toBe(0);
    expect(ids({}, "need")).toEqual(["GLREY", "BOKATAN", "MANDALORBOKATAN", "TIEFIGHTERIMPERIAL"]);
  });

  it("links to the unit page tab of the phase in scope, the platoon tab before the mission tab", () => {
    expect(unitHref(rows[1], 0)).toBe("/unit/BOKATAN");
    expect(unitHref(rows[1], 3)).toBe("/unit/BOKATAN?phase=3");
    expect(unitHref(rows[3], 3)).toBe("/unit/MANDALORBOKATAN?phase=3-mandalorians");
    expect(unitHref(rows[0], 3)).toBe("/unit/GLREY");
  });
});
