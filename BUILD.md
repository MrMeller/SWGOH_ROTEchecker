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

## 4. Roster data (swgoh.gg public API)

Checked on 2026-09-30. Cloudflare blocks every non-browser request, so the API needs a bot access key (applied for on swgoh.gg), sent as the `x-gg-bot-access` header. API terms: about 1 request per second, no large-scale production use, keys can be revoked at any time.

| Endpoint | Returns |
|---|---|
| `GET https://swgoh.gg/api/guild-profile/7JSQexIuSQeSTz94gaRsew/` | Guild name, `member_count` (41), `members[]` with `ally_code`, `player_name`, `last_activity_time`, `guild_join_time` |
| `GET https://swgoh.gg/api/player/{ally_code}/` | Player profile, `units[]`, plus large `mods[]` and `datacrons[]` blocks we discard |

To verify with a saved fixture before coding matching logic:

- Unit fields, expected: `units[].data.base_id`, `name`, `gear_level`, `relic_tier`, `rarity`, `combat_type`
- **Relic offset:** swgoh.gg is commonly reported to store `relic_tier` shifted by 2 (1 = locked, 2 = R0, 3 = R1 ... 12 = R10). **Verification fixture (MrMeller, ally code 528558646):** Rey (Galactic Legend), Supreme Leader Kylo Ren and Leia Organa (Galactic Legend) are R7 in game. If the API shows `relic_tier = 9` for them, the offset is 2. Write this as the first test in step 3.
- Unit catalogs (display names, combat type): `/api/characters/` and `/api/ships/`, cached in `data/fixtures/`

Trimmed snapshot format, committed to the repo as `data/snapshots/latest.json` plus a dated copy:

```json
{
  "syncedAt": "2026-10-05T03:00:00Z",
  "players": [
    { "allyCode": 528558646, "name": "MrMeller",
      "units": { "DARTHTRAYA": { "g": 13, "r": 7, "s": 7 } } }
  ]
}
```

Only units that appear in the requirements dataset are kept. Expected size: well under 1 MB for 41 players.

### Payload size

swgoh.gg has no "units only" option: the player endpoint always returns the full profile including mods and datacrons, and the older all-in-one guild endpoint (`/api/guild/{id}/`) returns 404. So the **download** cannot be made smaller; what we control is everything after it:

1. Fetch server-side only, weekly plus the rate-limited refresh (about 41 downloads per week).
2. Parse, keep only `base_id`, `gear_level`, `relic_tier`, `rarity` for units in the requirements dataset, discard the rest immediately.
3. Store and serve only the trimmed snapshot. The browser never sees the raw payload.
4. The sync runs as a GitHub Action (§7), which has no practical time limit, so no batching is needed.

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

1. **Phase overview** (home). Phase switcher P1 to P6 on top, last-sync timestamp and Refresh button. Three planet sections (DS, Mixed, LS), each a compact list of units with status chip, `meets / need` and `owned`. Filter: show only short units. Summary bar: X of Y units enough.
2. **Unit detail.** Requirement per phase and planet where this unit appears, ranked player list (§5.4).
3. **Focus list.** Across the selected phase, every short unit with the specific players whose gearing would close the gap soonest. Copy-to-clipboard button producing Discord-ready text.
4. **Planet page.** Opened from a planet card in the phase plan or a planet header. The six platoons as on the in-game board (platoons 1 to 3 in the left column, 4 to 6 in the right; stacked on phones), with unit portraits from the swgoh.gg catalog. Full colour when the plan fills the platoon; faded otherwise. In an open platoon, a unit with N slots and S spare players (meeting it, not used by the planned platoons) gets N minus S red-ringed slots, and the "Lacking" line names the units with how many more players each needs. That is what it takes to open this platoon next, on top of the plan, and it matches the unit counts in the list view. Badge per platoon: Filled, Almost (1 or 2 short), N short, or Held back (every unit available but used elsewhere).
5. **Player page.** Pick your name: units where the guild is short and you are among the closest candidates, sorted by your distance. This is the "what should I gear" view.
6. **Progress (v1.1).** Per phase: count of "enough" units over time from stored snapshots.

## 7. Sync and storage (no database)

Architecture: **JSON files in the GitHub repo, a GitHub Action does the sync, Vercel serves a static-ish site.** No Supabase, no Vercel Blob, no cron on Vercel.

```
GitHub Action (weekly, or triggered by Refresh)
  -> fetch guild profile -> fetch each current member -> trim
  -> commit data/snapshots/latest.json + data/snapshots/YYYY-MM-DD.json
  -> push triggers Vercel redeploy -> site shows new data
```

- **Schedule:** `.github/workflows/sync.yml` with `schedule` (e.g. Sunday 03:00 UTC) and `workflow_dispatch`.
- **Manual refresh:** the Refresh button calls `/api/refresh`, a small Vercel function that triggers `workflow_dispatch` via the GitHub API (fine-grained token with Actions permission on this repo only, stored as a Vercel env var). Cooldown 6 hours, checked against `syncedAt` in `latest.json`. The UI says "Refresh started, new data in about 3 minutes".
- **History for free:** every dated snapshot is a git commit, which powers the progress view later. Old dated files can be pruned to one per week.
- **Politeness:** sequential requests at about 1 per second (swgoh.gg API terms), descriptive `User-Agent`, API key from the `SWGOH_GG_API_KEY` Actions secret. A sync takes about 45 seconds.

### Membership changes

Guild membership is rebuilt from scratch on **every** sync:

1. First call is always the guild profile. Its `members[]` list is the only source of truth for who is in the guild.
2. Only those ally codes are fetched. Players who left are simply absent from the new snapshot; new joiners appear automatically.
3. If a current member's player fetch fails, reuse their units from the previous snapshot, mark them `stale: true`, and show that in the UI. Never reuse data for someone no longer in the guild.
4. The snapshot stores `memberCount` so the UI can show "41 members, synced 5 Oct".

When is a database worth it? Only if the app later needs to write user input (notes, assignments, "I'll gear this" claims). Not in v1.

## 8. Build plan

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Scaffold Next.js + Tailwind + Vitest, add `data/` files | `npm run dev` shows placeholder |
| 2 | Validation script: platoon structure and `base_id`s against the swgoh.gg catalogs | All planets 6 × 15, all units known |
| 3 | swgoh.gg client + trim, save a real fixture, measure sync duration | Fixture test confirms field names and relic offset |
| 4 | `matching.ts` and `status.ts` with tests (ladder, ships, status table) | Tests green |
| 5 | GitHub Action sync + refresh route with cooldown | Action commits `latest.json`, Vercel redeploys |
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
