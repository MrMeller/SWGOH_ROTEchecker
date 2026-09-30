import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allNames,
  checkTotals,
  normalizeName,
  parseRaw,
  resolveNames,
  type CatalogUnit,
  type Requirements,
} from "./requirements";

const data = (f: string) => readFileSync(path.join(__dirname, "../data", f), "utf8");
const catalog: CatalogUnit[] = [
  ...JSON.parse(data("fixtures/characters.json")),
  ...JSON.parse(data("fixtures/ships.json")),
];
const req: Requirements = JSON.parse(data("rote-requirements.json"));

describe("checkTotals", () => {
  it("passes on the real dataset, cross-checked against rote_raw.txt", () => {
    expect(checkTotals(req, parseRaw(data("rote_raw.txt")))).toEqual([]);
  });

  it("flags a planet that does not sum to 90", () => {
    const broken: Requirements = structuredClone(req);
    broken.phases[0].planets[0].units[0].required += 1;
    const errors = checkTotals(broken, parseRaw(data("rote_raw.txt")));
    expect(errors.some((e) => e.includes("91 slots"))).toBe(true);
    expect(errors.some((e) => e.includes("sheet phase total"))).toBe(true);
  });
});

describe("resolveNames", () => {
  const resolve = (names: string[], aliases = {}) => resolveNames(names, catalog, aliases);

  it("keeps every version of a character separate", () => {
    const pairs: [string, string][] = [
      ["REY", "GLREY"],
      ["REY (SCAVENGER)", "REY"],
      ["REY (JEDI TRAINING)", "REYJEDITRAINING"],
      ["ECHO", "BADBATCHECHO"],
      ['CT-21-0408 "ECHO"', "CT210408"],
      ["MAUL", "MAULS7"],
      ["DARTH MAUL", "MAUL"],
      ["BISTAN", "BISTAN"],
      ["BISTAN'S U-WING", "UWINGSCARIF"],
    ];
    const res = resolve(pairs.map(([n]) => n));
    expect(res.unresolved).toEqual([]);
    expect(res.errors).toEqual([]);
    for (const [name, baseId] of pairs) expect(res.resolved.get(name)?.baseId, name).toBe(baseId);
    expect(res.resolved.get("BISTAN'S U-WING")?.combatType).toBe(2);
  });

  it("does not fuzzy match", () => {
    expect(resolve(["REY (SCAV)"]).unresolved).toEqual(["REY (SCAV)"]);
    expect(normalizeName("REY (SCAVENGER)")).not.toBe(normalizeName("REY"));
  });

  it("applies aliases and rejects bad ones", () => {
    const res = resolve(["SLKR"], { SLKR: "SUPREMELEADERKYLOREN", GHOST: "NOPE" });
    expect(res.resolved.get("SLKR")?.via).toBe("alias");
    expect(res.errors.some((e) => e.includes("NOPE"))).toBe(true);
  });

  it("refuses two sheet names landing on one unit", () => {
    const res = resolve(["DARTH MAUL", "DMAUL"], { DMAUL: "MAUL" });
    expect(res.errors.some((e) => e.includes("resolve to MAUL"))).toBe(true);
  });

  it("resolves every name in the real dataset", () => {
    const res = resolve(allNames(req));
    expect(res.unresolved).toEqual([]);
    expect(res.ambiguous).toEqual([]);
    expect(res.errors).toEqual([]);
  });
});
