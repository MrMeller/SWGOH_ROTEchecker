// npm run demo
// Writes data/snapshots/demo.json: MrMeller's real roster (from the comlink fixture) plus
// generated demo players, calibrated on the June sheet counts. Used until the real sync
// writes latest.json.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { trimPlayer, type ComlinkGuild, type ComlinkPlayer } from "../lib/comlink";
import { demoPlayers, unitProfiles } from "../lib/demo";
import { parseRaw, wantedUnits } from "../lib/requirements";
import type { Snapshot } from "../lib/snapshot";
import { loadCatalog, loadPlatoons, loadRequirements, readJson, readText, root } from "./load";

const req = loadRequirements();
const catalog = loadCatalog();
const raw = parseRaw(readText("data/rote_raw.txt"));
const guild = readJson<ComlinkGuild>("data/fixtures/comlink-guild.json");
const me = readJson<ComlinkPlayer>("data/fixtures/comlink-player-528558646.json");

const memberCount = guild.guild.profile.memberCount;
const ships = new Set(catalog.filter((u) => u.combat_type === 2).map((u) => u.base_id));
const profiles = unitProfiles(req, raw, catalog);
const players = [trimPlayer(me, wantedUnits(loadPlatoons()), ships), ...demoPlayers(profiles, memberCount - 1)];

const snapshot: Snapshot = { syncedAt: "2026-10-02T00:00:00Z", memberCount, players, demo: true };
writeFileSync(path.join(root, "data/snapshots/demo.json"), JSON.stringify(snapshot) + "\n");
console.log(`Wrote ${players.length} players to data/snapshots/demo.json (${(JSON.stringify(snapshot).length / 1024).toFixed(0)} KB)`);
