import { describe, expect, it } from "vitest";
import { buildRequirements, checkPlatoons, normalizeName, parseRaw, sheetDifferences, wantedUnits } from "./requirements";
import { catalog, platoons, readData, requirements } from "./test-data";

describe("checkPlatoons", () => {
  it("passes on the real platoon data", () => {
    expect(checkPlatoons(platoons, catalog)).toEqual([]);
  });

  it("flags a short platoon and an unknown base_id", () => {
    const broken = structuredClone(platoons);
    broken.phases[0].planets[0].platoons[0].pop();
    broken.phases[0].planets[0].platoons[1][0] = "NOTAUNIT";
    const errors = checkPlatoons(broken, catalog);
    expect(errors.some((e) => e.includes("14 units, expected 15"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown base_id NOTAUNIT"))).toBe(true);
  });
});

describe("buildRequirements", () => {
  it("gives every planet 90 slots, in map order with bonus planets last", () => {
    for (const phase of requirements.phases) {
      for (const planet of phase.planets) expect(planet.units.reduce((a, u) => a + u.required, 0)).toBe(90);
    }
    const names = (n: number) => requirements.phases[n - 1].planets.map((p) => p.name);
    expect(names(1)).toEqual(["Mustafar", "Corellia", "Coruscant"]);
    expect(names(3)).toEqual(["Dathomir", "Tatooine", "Kashyyyk", "Zeffo"]);
    expect(names(4)).toEqual(["Haven-class Medical Station", "Kessel", "Lothal", "Mandalore"]);
    expect(requirements.phases[3].planets[3]).toMatchObject({ alignment: "Mixed", bonus: true });
  });

  it("counts units from the platoons and names them from the catalog", () => {
    const mustafar = requirements.phases[0].planets[0];
    expect(mustafar.units[0]).toEqual({ baseId: "DARTHTRAYA", name: "Darth Traya", combatType: 1, required: 7 });
    expect(mustafar.units.find((u) => u.baseId === "CAPITALCHIMAERA")).toMatchObject({ combatType: 2, required: 6 });
  });

  it("keeps different versions of a character apart", () => {
    const scarif = requirements.phases[5].planets.find((p) => p.name === "Scarif")!;
    expect(scarif.units.find((u) => u.baseId === "GLREY")?.name).toBe("Rey");
    expect(scarif.units.find((u) => u.baseId === "REY")?.name).toBe("Rey (Scavenger)");
  });

  it("does not depend on planet order in the file", () => {
    const shuffled = structuredClone(platoons);
    shuffled.phases[0].planets.reverse();
    expect(buildRequirements(shuffled, catalog).phases[0].planets.map((p) => p.name)).toEqual([
      "Mustafar",
      "Corellia",
      "Coruscant",
    ]);
  });

  it("lists every wanted unit", () => {
    expect(wantedUnits(platoons).size).toBe(293);
  });
});

describe("June sheet (reference only)", () => {
  it("matches the platoon data except for the two known unit swaps", () => {
    expect(sheetDifferences(requirements, parseRaw(readData("rote_raw.txt")), catalog)).toEqual([
      "P4 Lothal: GHOST 1 (sheet had 0)",
      "P4 Lothal: BLADEOFDORIN 1 (sheet had 2)",
      "P6 Hoth: HOTHREBELSCOUT 1 (sheet had 0)",
      "P6 Hoth: PAO 0 (sheet had 1)",
    ]);
  });

  it("matches names exactly, never fuzzily", () => {
    expect(normalizeName('CT-21-0408 "ECHO"')).toBe(normalizeName('CT-21-0408 "Echo"'));
    expect(normalizeName("REY (SCAVENGER)")).not.toBe(normalizeName("REY"));
  });
});
