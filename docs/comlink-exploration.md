# Roster data via swgoh-comlink instead of the swgoh.gg API

Exploration done 2026-10-02 with a local smoke test against comlink 4.5.0. Decided the same day: option A below, every 48 hours, no Refresh button, commit only on change. The spec (`BUILD.md` §4 and §7) is updated; the build checklist is at the end of this note.

## What comlink is

[swgoh-comlink](https://github.com/swgoh-utils/swgoh-comlink) is a small closed-source service (binary, 32 MB Docker image on `ghcr.io/swgoh-utils/swgoh-comlink`, releases roughly monthly, 4.5.0 in August 2026) that talks to the game's own read-only APIs and exposes them as HTTP. No swgoh.gg key, no player login. The guild endpoint uses an anonymous guest account that comlink derives from `APP_NAME` + public IP + port. Rate limit is Capital Games', about 20 requests per second per IP. It is the de facto standard behind most community tools, but it is not a sanctioned API: the README puts ToS compliance on the user. Our volume (one guild, 41 players, weekly plus a few refreshes) is negligible.

## Smoke test results (DutchJedi, MrMeller)

| Check | Result |
|---|---|
| Container start | ready in 2 s, no configuration beyond `APP_NAME` |
| `POST /guild` with our swgoh.gg guild id `7JSQexIuSQeSTz94gaRsew` | works unchanged: `guild.profile.name` DutchJedi, 41 of 50 members, 265 KB, 2 s |
| `guild.member[]` fields | `playerId`, `playerName`, `memberLevel`, `lastActivityTime` (ms), `guildJoinTime` (s), GP fields. **No `allyCode`.** |
| `POST /player` by `allyCode` or by `playerId` | both work, 2.4 MB, 0.6 to 1.1 s. Response has `allyCode`, `playerId`, `guildId`, `rosterUnit[]` (365 units) |
| Unit fields | `definitionId` `"GLREY:SEVEN_STAR"`, `currentRarity` (stars), `currentTier` (gear), `currentLevel`, `relic.currentTier` (null for ships, 1 when relics locked) |
| Relic offset | identical to swgoh.gg: Rey (GL), SLKR, Leia (GL) show `relic.currentTier: 9` = R7 |
| Trim comparison with the swgoh.gg fixture of 2026-09-30 | 266 of the 293 required units in roster, 264 identical, 2 differ upward (IPD R2 to R3, Commander Ahsoka R3 to R6), consistent with two days of roster progress |
| Payload breakdown | 2.2 of the 2.4 MB is mods inside `rosterUnit[].equippedStatMod`; after trim about 8 KB per player, about 300 KB for the guild, same as today |

Combat type is not in the roster payload. Ships are recognised from the catalog (`data/fixtures/ships.json`), which we already have.

## Hosting options (all free, nothing local)

**A. Comlink as a service container inside the GitHub Action (recommended).** The sync workflow declares `services: comlink: image: ghcr.io/swgoh-utils/swgoh-comlink:4.5.0` with `APP_NAME`, and `npm run sync` talks to `http://localhost:3000`. Nothing to host, no account anywhere, no secrets at all. The repo is public, so Actions minutes are unlimited. Cost per sync: 32 MB image pull, 2 s start, about 100 MB of player downloads on GitHub's network, about one minute at 1 request per second.
Only open point: the runner gets a fresh public IP every run, so comlink registers a new anonymous guest account each run (roughly 60 to 100 per year). CG has tolerated this pattern for other CI users as far as we can tell, but it is not documented. If it ever fails, fall back to B without changing the app.

**B. Comlink on a free always-on-ish host.** The maintainers' [deploy-swgoh-comlink](https://github.com/swgoh-utils/deploy-swgoh-comlink) repo deploys to Render (free: 512 MB, sleeps after 15 min idle, about 1 min cold start, no card), Northflank or Railway (trial only). The GitHub Action then calls it over HTTPS with the HMAC `ACCESS_KEY`/`SECRET_KEY`. Downsides: one more account and service to keep alive, HMAC signing in our client, and Render's outbound IP is shared and can change, so the guest identity is not more stable than in A. Koyeb now takes a card hold, Fly.io has no free tier anymore.

**C. Keep waiting for the swgoh.gg bot key.** Sanctioned API, 1 request per second, but blocked today and revocable at any time.

## Deltas against the current approach

| Area | Today (swgoh.gg) | With comlink |
|---|---|---|
| Access | bot key in `x-gg-bot-access`, Cloudflare | none; HMAC only for option B |
| Transport | `GET /api/guild-profile/{id}/`, `GET /api/player/{ally}/` | `POST /guild {payload:{guildId, includeRecentGuildActivityInfo:true}}`, `POST /player {payload:{playerId}}` |
| Member key | `ally_code` from the guild profile | `playerId`; `allyCode` comes from the player response |
| Unit id | `units[].data.base_id` | `rosterUnit[].definitionId` before the colon |
| Gear, stars, relic | `gear_level`, `rarity`, `relic_tier - 2` | `currentTier`, `currentRarity`, `relic.currentTier - 2` |
| Combat type | in the player payload | from the catalog (ships set) |
| Pace | 1 request per second (gg terms) | CG allows about 20 per second; keep 1 per second anyway |
| Sync duration | about 45 s (estimated) | about 60 s measured per-call (2 s start, 2 s guild, 41 × about 1 s) |
| Catalog refresh (`npm run validate`) | swgoh.gg `/api/characters/`, `/api/ships/` | still the cached fixtures; comlink `/data` unitsList is an 80 MB segment, only worth wiring when a new unit appears |

## Impact on the web app

- **UI: none.** Snapshot format stays `{ syncedAt, memberCount, players[{ allyCode, name, units, stale }] }`. Player URLs keep the ally code. The demo banner disappears by itself once `latest.json` exists.
- **Snapshot format: one optional field.** Add `playerId` to each player so a failed fetch can be matched to the previous snapshot (the guild list no longer has ally codes). Add `source: "comlink"` next to `syncedAt` for traceability.
- **Code to change:** `lib/swgoh.ts` becomes `lib/comlink.ts` (HTTP + trim, about the same size), `lib/sync.ts` keys members by `playerId`, `scripts/sync.ts` reads `COMLINK_URL` instead of the API key, one new fixture test from a trimmed comlink response. `lib/matching.ts`, `lib/status.ts`, `lib/plan.ts` and all pages are untouched.
- **New file:** `.github/workflows/sync.yml` (schedule + `workflow_dispatch`, comlink service container, commit `latest.json` and the dated copy only when a unit changed). The disabled Refresh button goes away; the "Data from" date stays.
- **Docs:** CLAUDE.md rule 4 and BUILD.md §4/§7 describe the swgoh.gg client; rewrite for comlink.

## Decisions (2026-10-02)

- **Source:** comlink as a service container in the GitHub Action (option A). Fallback B needs no app change.
- **Frequency:** every 48 hours, cron `17 1 */2 * *` (01:17 UTC on odd days of the month; one 24 h gap in 31-day months is harmless). Roughly 180 runs and 180 anonymous guest accounts a year instead of 365. Fewer runs is the lever if the guest accounts ever become a problem.
- **No Refresh button.** The page keeps the "Data from <date>" line. A manual run is the Run workflow button in the Actions tab, for the repo owner. This removes the API route, the GitHub token in Vercel and the cooldown.
- **Commit only on change.** A guild snapshot is about 300 KB (8 KB per player). In git the dated copy and `latest.json` are the same blob, and successive snapshots delta-compress to a few tens of KB, so the repository grows slowly; the checkout grows by one 300 KB file per changed sync, which is why BUILD.md §7 allows pruning dated files to one per week. A nightly commit for identical data would still be noise and a pointless deploy. The sync compares with `latest.json` ignoring `syncedAt` and writes nothing when no unit moved. Dated snapshots therefore only exist for days with progress.
- **Politeness:** keep 1 request per second even though CG allows about 20.
- **Player names:** the snapshot keeps every member's in-game name (`playerName` from `/guild`, `name` from `/player`), as it does today. Members pick their own name on the player page and names appear in unit lists and the Discord text. These are public in-game names, not real names, so nothing is anonymised.

## Two GitHub details to design around

1. Scheduled workflows in a public repo are disabled after 60 days without repository activity. The sync commits should count as activity; verify once after two quiet months. A manual run re-enables the schedule.
2. GitHub warns that cron jobs at the top of the hour can be delayed or dropped, hence 01:17.

## Build checklist

Built 2026-10-02 on `feature/comlink-sync` (items 1 to 8 and 10; item 9, the first live run, needs the workflow on `main`). The sync script was exercised twice against a fake comlink serving the fixtures: the first run wrote the snapshot, the second reported no change.

1. **`lib/snapshot.ts`:** move `TrimmedUnit` and `TrimmedPlayer` here (every importer of `./swgoh` only needs the types), add optional `playerId` to players and `source: "comlink"` to the snapshot.
2. **`lib/comlink.ts`:** raw types (`ComlinkGuild`, `ComlinkPlayer`, `RosterUnit`), `baseIdOf(definitionId)`, `relicFromTier` (unchanged), `trimPlayer(raw, wanted, ships)`, `fetchGuild(url, guildId)` and `fetchPlayer(url, playerId)` as POST with the `User-Agent`. Errors: non-200, and the comlink error body `{code, message}` (6 = rate exceeded, 32 = not found).
3. **`lib/comlink.test.ts`** on the two reduced fixtures: relic 9 is R7 for GLREY, SUPREMELEADERKYLOREN, GLLEIA; ships have `relic: null` and are trimmed to stars only; `definitionId` splits to a known base_id for every roster unit; guild members have `playerId` and no `allyCode`; a trimmed MrMeller matches a handful of expected units.
4. **`lib/sync.ts`:** members keyed by `playerId`, fetched by `playerId` at 1 per second, stale reuse matched by `playerId` (fall back to `allyCode` for the old demo shape). Add pure `snapshotChanged(previous, next)` that ignores `syncedAt`, with tests. Rewrite `lib/sync.test.ts` against a fake comlink.
5. **`scripts/sync.ts`:** `COMLINK_URL` (default `http://localhost:3000`), write `latest.json` and the dated copy only when changed, print the summary, and append `changed=true|false` to `$GITHUB_OUTPUT` when it is set.
6. **`.github/workflows/sync.yml`:** cron + `workflow_dispatch`, `permissions: contents: write`, a `concurrency` group, service `comlink` from `ghcr.io/swgoh-utils/swgoh-comlink:4.5.0` with `APP_NAME`, port 3000 and `--health-cmd "/swgoh-comlink --check"`, Node 22 with npm cache, `npm ci`, `npm run sync`, then commit "Sync roster YYYY-MM-DD" and push only when `changed=true`.
7. **Demo:** `scripts/make-demo-snapshot.ts` reads the comlink fixtures through the new trim (it uses the real MrMeller roster plus generated players); regenerate `demo.json`. `lib/demo.ts` only needs the moved types.
8. **Remove:** `lib/swgoh.ts`, `lib/swgoh.test.ts`, `data/fixtures/player-528558646.json` (2 MB) and `data/fixtures/guild-profile.json`, every `SWGOH_GG_API_KEY` mention, the disabled Refresh button in `components/PhaseOverview.tsx`. Keep `characters.json` and `ships.json` (catalogs).
9. **First live run** from the Actions tab: check duration and the stale/missing counts, confirm the commit and the Vercel deploy, compare overview numbers with the June sheet (BUILD.md §8 sanity check). The demo snapshot stays as the local fallback when `latest.json` is absent.
10. **Docs:** STATUS.md after the run; BUILD.md §9 gets the guest-account question closed or re-opened based on the first weeks.
