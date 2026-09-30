// npm run validate
// Checks data/rote-platoons.json: six phases, six platoons of 15 units per planet (90 slots),
// and every base_id known in the swgoh.gg catalogs (data/fixtures/). Then lists, for
// information only, where the platoon data differs from the June 2026 sheet.
import { buildRequirements, checkPlatoons, parseRaw, sheetDifferences, wantedUnits } from "../lib/requirements";
import { loadCatalog, loadPlatoons, readText } from "./load";

const data = loadPlatoons();
const catalog = loadCatalog();

const errors = checkPlatoons(data, catalog);
if (errors.length) {
  console.error(`✗ ${errors.length} error(s) in data/rote-platoons.json:`);
  for (const e of errors) console.error(`  ${e}`);
  console.error("\nValidation FAILED");
  process.exit(1);
}

const req = buildRequirements(data, catalog);
const planets = req.phases.flatMap((p) => p.planets);
const bonus = planets.filter((p) => p.bonus).map((p) => p.name);
console.log(`✓ ${planets.length} planets (bonus: ${bonus.join(", ")}), each 6 platoons of 15 units`);
console.log(`✓ ${wantedUnits(data).size} distinct units, all known in the swgoh.gg catalogs`);

const diffs = sheetDifferences(req, parseRaw(readText("data/rote_raw.txt")), catalog);
if (diffs.length) {
  console.log(`\nℹ ${diffs.length} difference(s) from the June 2026 sheet (the platoon data wins):`);
  for (const d of diffs) console.log(`  ${d}`);
}
