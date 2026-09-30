// npm run demo
// Writes data/snapshots/demo.json: MrMeller's real roster (from the fixture) plus
// generated demo players, calibrated on the sheet counts. Used until the real sync
// writes latest.json.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { demoPlayers, unitProfiles } from "../lib/demo";
import { parseRaw, type Requirements } from "../lib/requirements";
import type { Snapshot } from "../lib/snapshot";
import { trimPlayer, type RawGuildProfile, type RawPlayer } from "../lib/swgoh";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const req = JSON.parse(read("data/rote-requirements.json")) as Requirements;
const raw = parseRaw(read("data/rote_raw.txt"));
const guild = JSON.parse(read("data/fixtures/guild-profile.json")) as RawGuildProfile;
const me = JSON.parse(read("data/fixtures/player-528558646.json")) as RawPlayer;

const wanted = new Set(req.phases.flatMap((p) => p.planets.flatMap((pl) => pl.units.map((u) => u.baseId!))));
const memberCount = guild.data.member_count;
const players = [trimPlayer(me, wanted), ...demoPlayers(unitProfiles(req, raw), memberCount - 1)];

const snapshot: Snapshot = { syncedAt: "2026-09-30T00:00:00Z", memberCount, players, demo: true };
const out = path.join(root, "data/snapshots/demo.json");
writeFileSync(out, JSON.stringify(snapshot) + "\n");
console.log(`Wrote ${players.length} players to data/snapshots/demo.json (${(JSON.stringify(snapshot).length / 1024).toFixed(0)} KB)`);
