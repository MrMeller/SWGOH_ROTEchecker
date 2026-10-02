// npm run sync
// Fetches the guild and every current member through swgoh-comlink and writes
// data/snapshots/latest.json plus a dated copy, but only when a roster changed.
// COMLINK_URL points at comlink (default http://localhost:3000, the service container in the Action).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_COMLINK_URL } from "../lib/comlink";
import { wantedUnits } from "../lib/requirements";
import type { Snapshot } from "../lib/snapshot";
import { runSync } from "../lib/sync";
import { loadCatalog, loadPlatoons } from "./load";

const root = path.resolve(import.meta.dirname, "..");
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

const baseUrl = process.env.COMLINK_URL ?? DEFAULT_COMLINK_URL;
const wanted = wantedUnits(loadPlatoons());
const ships = new Set(loadCatalog().filter((u) => u.combat_type === 2).map((u) => u.base_id));
const latestPath = path.join(root, "data/snapshots/latest.json");
const previous = existsSync(latestPath) ? (JSON.parse(readFileSync(latestPath, "utf8")) as Snapshot) : undefined;

const setOutput = (changed: boolean) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
};

const started = Date.now();
console.log(`Syncing through comlink at ${baseUrl}`);
const result = await runSync({ baseUrl, wanted, ships, previous, log: (m) => console.log(m) });
const { snapshot, failed, stale, missing, changed } = result;
const seconds = ((Date.now() - started) / 1000).toFixed(0);

const fresh = snapshot.players.filter((p) => !p.stale).length;
if (fresh === 0) {
  console.error(`No player could be fetched (${failed.length} failed). Nothing written.`);
  setOutput(false);
  process.exit(1);
}

console.log(`✓ ${fresh} fresh, ${stale.length} stale, ${missing.length} missing of ${snapshot.memberCount} members in ${seconds}s`);
if (stale.length) console.warn(`! Old data reused for: ${stale.map((p) => p.name).join(", ")}`);
if (missing.length) console.warn(`! No data at all for: ${missing.map((p) => p.name).join(", ")}`);

if (!changed) {
  console.log(`= No roster changes since ${previous!.syncedAt}. Nothing written.`);
  setOutput(false);
  process.exit(0);
}

const json = JSON.stringify(snapshot) + "\n";
const datedPath = path.join(root, `data/snapshots/${snapshot.syncedAt.slice(0, 10)}.json`);
writeFileSync(latestPath, json);
writeFileSync(datedPath, json);
console.log(`✓ Wrote data/snapshots/latest.json and ${path.relative(root, datedPath)} (${(json.length / 1024).toFixed(0)} KB)`);
setOutput(true);
