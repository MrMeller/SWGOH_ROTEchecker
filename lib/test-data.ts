// Real datasets for tests (not used by the app).
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildRequirements, type CatalogUnit, type PlatoonData } from "./requirements";

const data = (rel: string) => readFileSync(path.join(__dirname, "../data", rel), "utf8");

export const catalog: CatalogUnit[] = [
  ...(JSON.parse(data("fixtures/characters.json")) as CatalogUnit[]),
  ...(JSON.parse(data("fixtures/ships.json")) as CatalogUnit[]),
];
export const platoons = JSON.parse(data("rote-platoons.json")) as PlatoonData;
export const requirements = buildRequirements(platoons, catalog);
export const readData = data;
