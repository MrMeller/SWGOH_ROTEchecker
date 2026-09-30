import { describe, expect, it } from "vitest";
import { demoPlayers, unitProfiles } from "./demo";
import { parseRaw } from "./requirements";
import { catalog, readData, requirements } from "./test-data";

const profiles = unitProfiles(requirements, parseRaw(readData("rote_raw.txt")), catalog);

describe("demo players", () => {
  it("has a profile for every required unit, including bonus planet units", () => {
    expect(profiles.size).toBe(293);
    expect(profiles.get("DOCTORAPHRA")).toMatchObject({ ownFrac: 0.5 });
  });

  it("is deterministic and clearly named as demo", () => {
    const a = demoPlayers(profiles, 5);
    expect(demoPlayers(profiles, 5)).toEqual(a);
    expect(a.every((p) => p.name.startsWith("Demo Player"))).toBe(true);
  });

  it("only produces valid levels", () => {
    for (const p of demoPlayers(profiles, 40)) {
      for (const u of Object.values(p.units)) {
        expect(u.s).toBeGreaterThanOrEqual(1);
        expect(u.s).toBeLessThanOrEqual(7);
        if (u.r !== undefined) {
          expect(u.g).toBe(13);
          expect(u.s).toBe(7);
          expect(u.r).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});
