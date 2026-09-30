// npm run demo
// Writes data/snapshots/demo.json: MrMeller's real roster (from the fixture) plus
// generated demo players, calibrated on the June sheet counts. Used until the real sync
// writes latest.json.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { demoPlayers, unitProfiles } from "../lib/demo";
import { parseRaw, wantedUnits } from "../lib/requirements";
import type { Snapshot } from "../lib/snapshot";
import { trimPlayer, type RawGuildProfile, type RawPlayer } from "../lib/swgoh";
import { loadCatalog, loadPlatoons, loadRequirements, readJson, readText, root } from "./load";

const req = loadRequirements();
const raw = parseRaw(readText("data/rote_raw.txt"));
const guild = readJson<RawGuildProfile>("data/fixtures/guild-profile.json");
const me = readJson<RawPlayer>("data/fixtures/player-528558646.json");

const memberCount = guild.data.member_count;
const profiles = unitProfiles(req, raw, loadCatalog());
const players = [trimPlayer(me, wantedUnits(loadPlatoons())), ...demoPlayers(profiles, memberCount - 1)];

const snapshot: Snapshot = { syncedAt: "2026-09-30T00:00:00Z", memberCount, players, demo: true };
writeFileSync(path.join(root, "data/snapshots/demo.json"), JSON.stringify(snapshot) + "\n");
console.log(`Wrote ${players.length} players to data/snapshots/demo.json (${(JSON.stringify(snapshot).length / 1024).toFixed(0)} KB)`);
