// npm run sync
// Fetches the guild and every current member from swgoh.gg and writes
// data/snapshots/latest.json plus a dated copy. Needs SWGOH_GG_API_KEY
// (GitHub Actions secret, or a local .env file that is never committed).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { wantedUnits } from "../lib/requirements";
import type { Snapshot } from "../lib/snapshot";
import { runSync } from "../lib/sync";
import { loadPlatoons } from "./load";

const root = path.resolve(import.meta.dirname, "..");
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

const apiKey = process.env.SWGOH_GG_API_KEY;
if (!apiKey) {
  console.error("SWGOH_GG_API_KEY is not set. Add it as a GitHub Actions secret, or to .env for a local run.");
  process.exit(1);
}

const wanted = wantedUnits(loadPlatoons());
const latestPath = path.join(root, "data/snapshots/latest.json");
const previous = existsSync(latestPath) ? (JSON.parse(readFileSync(latestPath, "utf8")) as Snapshot) : undefined;

const started = Date.now();
const result = await runSync({ apiKey, wanted, previous, log: (m) => console.log(m) });
const { snapshot, failed, stale, missing } = result;

const fresh = snapshot.players.filter((p) => !p.stale).length;
if (fresh === 0) {
  console.error(`No player could be fetched (${failed.length} failed). Nothing written.`);
  process.exit(1);
}

const json = JSON.stringify(snapshot) + "\n";
const datedPath = path.join(root, `data/snapshots/${snapshot.syncedAt.slice(0, 10)}.json`);
writeFileSync(latestPath, json);
writeFileSync(datedPath, json);

const seconds = ((Date.now() - started) / 1000).toFixed(0);
console.log(`✓ ${fresh} fresh, ${stale.length} stale, ${missing.length} missing of ${snapshot.memberCount} members in ${seconds}s`);
console.log(`✓ Wrote data/snapshots/latest.json and ${path.relative(root, datedPath)} (${(json.length / 1024).toFixed(0)} KB)`);
if (stale.length) console.warn(`! Old data reused for: ${stale.map((p) => p.name).join(", ")}`);
if (missing.length) console.warn(`! No data at all for: ${missing.map((p) => p.name).join(", ")}`);
