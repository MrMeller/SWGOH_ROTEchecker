// Shared file loading for the npm scripts (the site uses lib/data.ts instead).
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildRequirements, type CatalogUnit, type PlatoonData } from "../lib/requirements";

export const root = path.resolve(import.meta.dirname, "..");
export const readText = (rel: string) => readFileSync(path.join(root, rel), "utf8");
export const readJson = <T>(rel: string) => JSON.parse(readText(rel)) as T;

export const loadCatalog = (): CatalogUnit[] => [
  ...readJson<CatalogUnit[]>("data/fixtures/characters.json"),
  ...readJson<CatalogUnit[]>("data/fixtures/ships.json"),
];

export const loadPlatoons = () => readJson<PlatoonData>("data/rote-platoons.json");

export const loadRequirements = () => buildRequirements(loadPlatoons(), loadCatalog());
