// npm run validate
// Checks planet/phase totals and resolves every sheet name to a swgoh.gg base_id,
// using the cached catalogs in data/fixtures/ plus data/unit-aliases.json.
// With --write, stores baseId and combatType back into rote-requirements.json.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  allNames,
  applyResolution,
  checkTotals,
  parseRaw,
  resolveNames,
  type Aliases,
  type CatalogUnit,
  type Requirements,
} from "../lib/requirements";

const root = path.resolve(import.meta.dirname, "..");
const read = <T>(rel: string): T => JSON.parse(readFileSync(path.join(root, rel), "utf8")) as T;

const reqPath = "data/rote-requirements.json";
const req = read<Requirements>(reqPath);
const raw = parseRaw(readFileSync(path.join(root, "data/rote_raw.txt"), "utf8"));
const aliases = read<Aliases>("data/unit-aliases.json");
const catalog = [
  ...read<CatalogUnit[]>("data/fixtures/characters.json"),
  ...read<CatalogUnit[]>("data/fixtures/ships.json"),
];

let failed = false;

const totalErrors = checkTotals(req, raw);
if (totalErrors.length) {
  failed = true;
  console.error(`\n✗ ${totalErrors.length} total error(s):`);
  for (const e of totalErrors) console.error(`  ${e}`);
} else {
  const planets = req.phases.reduce((a, p) => a + p.planets.length, 0);
  console.log(`✓ Totals: ${planets} planets at 90 slots, phase totals match rote_raw.txt`);
}

const names = allNames(req);
const res = resolveNames(names, catalog, aliases);

if (res.errors.length) {
  failed = true;
  console.error(`\n✗ ${res.errors.length} resolution error(s):`);
  for (const e of res.errors) console.error(`  ${e}`);
}
if (res.unresolved.length) {
  failed = true;
  console.error(`\n✗ ${res.unresolved.length} unresolved name(s), add them to data/unit-aliases.json:`);
  for (const n of res.unresolved) console.error(`  ${n}`);
}
if (res.ambiguous.length) {
  failed = true;
  console.error(`\n✗ ${res.ambiguous.length} ambiguous name(s):`);
  for (const a of res.ambiguous) {
    console.error(`  ${a.name}: ${a.candidates.map((c) => `${c.base_id} (${c.name})`).join(", ")}`);
  }
}

const viaAlias = [...res.resolved.values()].filter((r) => r.via === "alias").length;
console.log(`${failed ? "\n" : "✓ "}Names: ${res.resolved.size} of ${new Set(names).size} resolved (${viaAlias} via alias)`);

if (failed) {
  console.error("\nValidation FAILED");
  process.exit(1);
}

if (process.argv.includes("--write")) {
  const next = applyResolution(req, res.resolved);
  writeFileSync(path.join(root, reqPath), JSON.stringify(next, null, 1) + "\n");
  console.log(`✓ Wrote baseId and combatType into ${reqPath}`);
} else {
  // Also fail if the stored IDs have drifted from what resolution produces now.
  const stale = req.phases
    .flatMap((p) => p.planets.flatMap((pl) => pl.units))
    .filter((u) => {
      const r = res.resolved.get(u.name)!;
      return u.baseId !== r.baseId || u.combatType !== r.combatType;
    });
  if (stale.length) {
    console.error(`\n✗ ${stale.length} unit entries have missing or outdated baseId/combatType.`);
    console.error("  Run: npm run validate -- --write");
    process.exit(1);
  }
  console.log("✓ Stored baseId/combatType are up to date");
}
