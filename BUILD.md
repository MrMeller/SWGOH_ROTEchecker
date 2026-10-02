# BUILD.md: RotE Platoon Tracker

Version 0.1, 2026-09-30. Owner: MrMeller (DutchJedi).

## 1. Goal

Replace the DutchJedi "RotE Guild Operations Unit Overview" Google Sheet with an interactive web app on Vercel that shows, per phase:

1. Which required units the guild has **enough** of
2. Which are **almost** enough
3. Which are **short**, and for those, **which players are closest** to meeting the requirement, so officers can ask the right people to gear the right units

Secondary goal: track progress over time via weekly snapshots.

**Non-goals (v1):** managing the TB itself. No platoon assignments, no "who places what", no skipping or parking units. The app only gives insight into units.

## 2. Users

| User | Needs |
|---|---|
| Officers | Phase-level gap overview, a ranked "who should gear what" list to share in Discord |
| Members | "What should I gear next to help the guild?" for their own roster |

No login. Everything is public-readable. Guild data on swgoh.gg is already public.

## 3. Requirements dataset

Source of truth: `data/rote-platoons.json`, read on 2026-09-30 from the swgoh.gg platoon board (https://swgoh.gg/territory-battles/t05D/platoons/?view=board). For every phase and planet it lists the 6 platoons and the 15 unit `base_id`s in each. Per-planet counts are derived from it at build time (`buildRequirements` in `lib/requirements.ts`), so there is nothing to resolve by name.

Validated facts:

- A platoon only pays out when all 15 slots are filled (confirmed by the guild)
- 6 phases × 3 planets (Dark Side, Mixed, Light Side) = 18 regular planets, plus 2 bonus planets: **Zeffo** (P3, Light Side) and **Mandalore** (P4, Mixed). Bonus planets must be unlocked first.
- Every planet has 6 platoons × 15 slots = **90 slots**
- 293 distinct units across all platoons, every `base_id` known in the swgoh.gg catalogs
- A unit can appear more than once in a platoon

Shape:

```json
{
  "source": "...",
  "phases": [
    { "phase": 1, "minRelic": 5,
      "planets": [
        { "name": "Mustafar", "alignment": "Dark Side", "bonus": false,
          "platoons": [ ["EMPERORPALPATINE", "BT1", "..."] ] }
      ] }
  ]
}
```

The June 2026 guild sheet (`data/rote_raw.txt`, transcribed by Jim Petron & Mhann) is kept for reference and for calibrating the demo data. It matches the platoon data except for one unit swap on Lothal (P4) and one on Hoth (P6); `npm run validate` lists them.

When the game changes platoons: update `data/rote-platoons.json` from the swgoh.gg board and run `npm run validate`.

## 4. Roster data (swgoh-comlink)

Decided 2026-10-02 after a smoke test (findings in `docs/comlink-exploration.md`). The sync reads the game's own data through [swgoh-comlink](https://github.com/swgoh-utils/swgoh-comlink), run as a service container inside the GitHub Action: no API key, no login, nothing hosted. swgoh.gg's API was the first choice, but Cloudflare blocks it without a bot access key.

| Endpoint (POST, JSON body) | Returns |
|---|---|
| `/guild` with `{"payload":{"guildId":"7JSQexIuSQeSTz94gaRsew","includeRecentGuildActivityInfo":true},"enums":false}` | `guild.profile` (`id`, `name`, `memberCount`, `memberMax`) and `guild.member[]` with `playerId`, `playerName`, `memberLevel`, `lastActivityTime` (ms), `guildJoinTime` (s). **No ally codes.** |
| `/player` with `{"payload":{"playerId":"..."},"enums":false}` (`allyCode` also works) | `name`, `allyCode`, `playerId`, `guildId`, `rosterUnit[]`. About 2.4 MB, of which 2.2 MB are mods we discard. |

Fixtures from the smoke test, reduced to the fields and units we use: `data/fixtures/comlink-guild.json` and `data/fixtures/comlink-player-528558646.json`. What `lib/comlink.test.ts` pins:

- `rosterUnit[].definitionId` is `"BASEID:SEVEN_STAR"`; the `base_id` is the part before the colon.
- `currentTier` is the gear level, `currentRarity` the stars. `currentLevel` is ignored.
- `relic.currentTier` is shifted by 2, like on swgoh.gg: 1 = locked, 2 = R0 ... 12 = R10, `null` for ships. **Verification:** MrMeller's Rey (Galactic Legend), Supreme Leader Kylo Ren and Leia Organa (Galactic Legend) are R7 in game and show 9.
- Combat type is not in the payload: a unit is a ship when its `base_id` is in `data/fixtures/ships.json`.
- Unit catalogs (display names, combat type, portraits) stay the swgoh.gg catalogs cached in `data/fixtures/`. Refresh them only when a platoon lists an unknown unit.

Trimmed snapshot format, committed to the repo as `data/snapshots/latest.json` plus a dated copy:

```json
{
  "syncedAt": "2026-10-05T01:18:00Z",
  "source": "comlink",
  "memberCount": 41,
  "players": [
    { "allyCode": 528558646, "playerId": "7bPGpb2VSf6xaD-tEtyQNw", "name": "MrMeller",
      "units": { "DARTHTRAYA": { "g": 13, "r": 3, "s": 7 } } }
  ]
}
```

Only units that appear in the requirements dataset are kept. Size: about 8 KB per player, about 300 KB for the guild. Player names are the public in-game names (decided 2026-10-02): members need them to find themselves, and no real names are involved.

### Payload size

Comlink has no "units only" option: the player endpoint always returns the full roster including mods. So the **download** cannot be made smaller; what we control is everything after it:

1. Fetch server-side only, in the GitHub Action, every other night (about 41 downloads, 100 MB, on GitHub's network).
2. Parse, keep only `base_id`, gear, relic and stars for units in the requirements dataset, discard the rest immediately.
3. Store and serve only the trimmed snapshot (about 300 KB). The browser never sees the raw payload.
4. The Action has no practical time limit, so no batching is needed.

## 5. Matching and scoring

### 5.1 Progress ladder (characters)

One continuous step scale so "distance" is comparable:

```
step = gear_level                 (for gear 1 to 12)
step = 13 + relic                 (for gear 13, relic 0 to 10)
target(phase) = 13 + minRelic
distance = max(0, target - step)
```

Examples for Phase 1 (R5, target 18): R5 or higher = 0, R3 = 2, G13 R0 = 5, G11 = 7.

Characters also need 7 stars to unlock relics. If `rarity < 7`, show a "needs stars" flag and sort them after players at 7 stars with equal distance.

### 5.2 Ships

`meets = rarity == 7`. Distance = `7 - rarity`. Not owned = no distance.

### 5.3 Per-unit status for a phase

No "almost" threshold. Let `need = phase total`, `maxPlanet = highest single-planet count`, `meets = players meeting the requirement`.

| Status | Rule | Colour |
|---|---|---|
| Enough | `meets >= need` | green |
| Planet only | `maxPlanet <= meets < need` | yellow (same as sheet legend) |
| Short | `meets < maxPlanet` | red |

Always show the numbers: `meets / need`, plus `owned` (players who have the unit at all).

### 5.4 Player list for a unit

Two groups:

1. **Meets requirement:** count plus names.
2. **Owned, not yet there:** sorted from closest to furthest by the ladder in §5.1, so the highest relic (for example R8 when R9 is needed) is at the top and gear 1 at the bottom. Each row shows the current level as it appears in game: `R8`, `R0`, `G12`, `G3`; for ships `6★`.

Players who don't own the unit are shown only as a count.

### 5.5 Platoon plan per phase

A platoon only scores when all 15 slots are filled, and a player fills a unit once per phase, so platoons compete for the same players across all planets. `lib/plan.ts` finds the **largest set of platoons that can be filled at the same time**, given how many players meet each unit (exact branch and bound, about 1 ms per phase). On a tie it prefers regular planets over bonus planets, then platoons that need fewer scarce units.

Shown as six pills per planet: filled when the plan fills that platoon, open otherwise. Per unit and planet, "short for N platoons" counts the open platoons it is in where it has no spare player left after the planned ones.

## 6. Screens

Mobile first. Most members will open this from Discord on a phone.

1. **Phase overview** (home). Phase switcher P1 to P6 on top and the snapshot date ("Data from ..."). Summary bar (X of Y units enough), the phase plan with a card per planet (platoon pills, tap for the planet board), then one table with a row per unit: optionally (toggle, off by default) a cell per planet showing players the plan places / slots on that planet (green covered, red when we lack players there, plain when the players are used elsewhere, a dot when not needed), and a have / need total with the spare count. Status as a coloured left edge. Sorted short first; tapping a planet header sorts by that planet. Filter: show only short units, remembered per browser.
2. **Unit detail.** Requirement per phase and planet where this unit appears, ranked player list (§5.4).
3. **Focus list.** Across the selected phase, every short unit with the specific players whose gearing would close the gap soonest. Copy-to-clipboard button producing Discord-ready text.
4. **Planet page.** Opened from a planet card in the phase plan or a planet header. The six platoons as on the in-game board (platoons 1 to 3 in the left column, 4 to 6 in the right; stacked on phones), with unit portraits from the swgoh.gg catalog. Full colour when the plan fills the platoon; faded otherwise. In an open platoon, a unit with N slots and S spare players (meeting it, not used by the planned platoons) gets N minus S red-ringed slots, and the "Lacking" line names the units with how many more players each needs. That is what it takes to open this platoon next, on top of the plan, and it matches the unit counts in the list view. Badge per platoon: Filled, Almost (1 or 2 short), N short, or Held back (every unit available but used elsewhere).
5. **Player page.** Pick your name: units where the guild is short and you are among the closest candidates, sorted by your distance. This is the "what should I gear" view.
6. **Progress (v1.1).** Per phase: count of "enough" units over time from stored snapshots.

## 7. Sync and storage (no database)

Architecture: **JSON files in the GitHub repo, a GitHub Action does the sync, Vercel serves a static-ish site.** No database, no Blob, no cron on Vercel, no secrets anywhere.

```
GitHub Action (every other night, 01:17 UTC)
  -> start swgoh-comlink as a service container on the runner
  -> POST /guild -> POST /player for each current member -> trim
  -> nothing changed? stop. changed? commit data/snapshots/latest.json + data/snapshots/YYYY-MM-DD.json
  -> push triggers Vercel redeploy -> site shows new data
```

- **Schedule:** `.github/workflows/sync.yml` with cron `17 1 */2 * *` (odd days of the month, off the hour as GitHub advises) plus `workflow_dispatch` for a manual run from the Actions tab. Every 48 hours is the trade-off between fresh data and the number of anonymous guest accounts comlink registers (one per run, because every runner has a new public IP). Rosters change slowly, so this is enough.
- **Comlink:** `ghcr.io/swgoh-utils/swgoh-comlink` pinned to a version, `APP_NAME=dutchjedi-rote-tracker`, reached at `http://localhost:3000` on the runner, health check before the sync starts. Bump the version by hand after reading the release notes.
- **No Refresh button** (decided 2026-10-02): no API route, no GitHub token in Vercel, no cooldown. The page shows "Data from <date>".
- **Commit only on change:** `npm run sync` compares the new snapshot with `latest.json` ignoring `syncedAt` and writes nothing when no unit moved. Quiet weeks produce no commits and no deploys, and every dated snapshot marks a day with real progress, which powers the progress view later. In git the dated copy and `latest.json` are the same blob and successive snapshots delta-compress well; the checkout grows by about 300 KB per changed sync, so prune old dated files to one per week when that matters.
- **Politeness:** sequential requests at about 1 per second (CG allows about 20 per IP per second), descriptive `User-Agent`. About one minute per sync.
- **Keep-alive:** GitHub disables scheduled workflows in a public repo after 60 days without repository activity. The sync commits should count; check after two quiet months and re-enable from the Actions tab if needed.

### Membership changes

Guild membership is rebuilt from scratch on **every** sync:

1. First call is always `/guild`. Its `member[]` list is the only source of truth for who is in the guild.
2. Only those `playerId`s are fetched. Players who left are simply absent from the new snapshot; new joiners appear automatically.
3. If a current member's player fetch fails, reuse their units from the previous snapshot (matched by `playerId`), mark them `stale: true`, and show that in the UI. Never reuse data for someone no longer in the guild.
4. The snapshot stores `memberCount` so the UI can show "41 members, synced 5 Oct".

When is a database worth it? Only if the app later needs to write user input (notes, assignments, "I'll gear this" claims). Not in v1.

## 8. Build plan

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Scaffold Next.js + Tailwind + Vitest, add `data/` files | `npm run dev` shows placeholder |
| 2 | Validation script: platoon structure and `base_id`s against the swgoh.gg catalogs | All planets 6 × 15, all units known |
| 3 | comlink client + trim, reduced fixtures from a real response | Fixture test confirms field names and relic offset |
| 4 | `matching.ts` and `status.ts` with tests (ladder, ships, status table) | Tests green |
| 5 | GitHub Action with comlink service container, every other night, commit on change | Action commits `latest.json`, Vercel redeploys, Refresh button removed |
| 6 | Phase overview screen | Matches sheet colours for a sample phase |
| 7 | Unit detail + focus list + Discord copy | Officers can use it |
| 8 | Player page | Members can use it |
| 9 | Progress chart | v1.1 |

Sanity check for step 6: the sheet's "units that meet reqs" column (in `rote_raw.txt`, June 2026) should be in the same ballpark as the app's numbers; differences are expected because rosters have progressed since then.

## 9. Open questions

1. Should departed members' old data ever count? (Proposed: no, current roster only.)
2. ~~"Almost" threshold~~ Decided 2026-09-30: no threshold, show counts and a sorted list (§5.4).
3. ~~"Won't fill" flag~~ Decided 2026-09-30: out of scope, insight only.
4. ~~Public URL or unlisted?~~ Decided 2026-09-30: public.
5. ~~Bonus planets: needed?~~ Decided 2026-09-30: yes, Zeffo and Mandalore are included.
