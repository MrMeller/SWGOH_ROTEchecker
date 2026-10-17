// npm run validate
// Checks data/rote-platoons.json: six phases, six platoons of 15 units per planet (90 slots),
// and every base_id known in the swgoh.gg catalogs (data/fixtures/). Checks
// data/rote-special-missions.json: known planets, units and tags, squads at least the named
// units, unlocks pointing at a later bonus planet. Then lists, for information only, where
// the platoon data differs from the June 2026 sheet.
import { checkMissions, keptUnits } from "../lib/missions";
import { buildRequirements, checkPlatoons, parseRaw, sheetDifferences, wantedUnits } from "../lib/requirements";
import { loadCatalog, loadMissions, loadPlatoons, readText } from "./load";

const data = loadPlatoons();
const missions = loadMissions();
const catalog = loadCatalog();

const fail = (file: string, errors: string[]) => {
  console.error(`✗ ${errors.length} error(s) in ${file}:`);
  for (const e of errors) console.error(`  ${e}`);
  console.error("\nValidation FAILED");
  process.exit(1);
};

const errors = checkPlatoons(data, catalog);
if (errors.length) fail("data/rote-platoons.json", errors);
const missionErrors = checkMissions(missions, data, catalog);
if (missionErrors.length) fail("data/rote-special-missions.json", missionErrors);

const req = buildRequirements(data, catalog);
const planets = req.phases.flatMap((p) => p.planets);
const bonus = planets.filter((p) => p.bonus).map((p) => p.name);
console.log(`✓ ${planets.length} planets (bonus: ${bonus.join(", ")}), each 6 platoons of 15 units`);
console.log(`✓ ${wantedUnits(data).size} distinct units, all known in the swgoh.gg catalogs`);
const unlocks = missions.missions.filter((m) => m.unlocks).map((m) => `${m.planet} unlocks ${m.unlocks!.planet}`);
const missionPlanets = new Set(missions.missions.map((m) => `${m.phase}/${m.planet}`)).size;
console.log(`✓ ${missions.missions.length} special missions on ${missionPlanets} planets (${unlocks.join(", ")})`);
console.log(`✓ ${keptUnits(data, missions, catalog).size} units kept per player by the sync (platoons plus missions)`);

const diffs = sheetDifferences(req, parseRaw(readText("data/rote_raw.txt")), catalog);
if (diffs.length) {
  console.log(`\nℹ ${diffs.length} difference(s) from the June 2026 sheet (the platoon data wins):`);
  for (const d of diffs) console.log(`  ${d}`);
}
