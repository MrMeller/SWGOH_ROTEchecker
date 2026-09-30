import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { demoPlayers, unitProfiles } from "./demo";
import { parseRaw, type Requirements } from "./requirements";

const read = (f: string) => readFileSync(path.join(__dirname, "../data", f), "utf8");
const profiles = unitProfiles(JSON.parse(read("rote-requirements.json")) as Requirements, parseRaw(read("rote_raw.txt")));

describe("demo players", () => {
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
