# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**RotE Platoon Tracker** for the SWGOH guild **DutchJedi**. A small web app that replaces the "RotE Guild Operations Unit Overview" Google Sheet. It answers one question per phase of the Rise of the Empire territory battle:

> For every unit the platoons need, do we have enough guild members who meet the requirement, and if not, who is closest to getting there?

Full product spec: `BUILD.md`. Read it before starting any feature.

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel
- Tailwind CSS for styling
- No database. Roster snapshots are JSON files committed to this repo
- GitHub Actions runs the weekly sync (and on demand via the Refresh button)
- Vitest for unit tests

Keep dependencies minimal. No auth, no user accounts. The app is read-only for visitors apart from the refresh button.

## Repository layout (target)

```
data/
  rote-requirements.json   # platoon requirements, hand-maintained, source of truth
  rote_raw.txt             # original sheet transcription, kept for audit
  unit-aliases.json        # sheet name -> swgoh.gg base_id overrides
  snapshots/latest.json    # written by the sync, never by hand
  snapshots/YYYY-MM-DD.json
lib/
  swgoh.ts                 # swgoh.gg API client (fetch + trim)
  matching.ts              # meets / distance logic (pure functions)
  status.ts                # green / yellow / red per unit per phase
app/
  page.tsx                 # phase overview
  unit/[baseId]/page.tsx   # unit detail, sorted players
  player/[allyCode]/page.tsx
  api/refresh/route.ts     # triggers the GitHub Action, 6h cooldown
scripts/
  sync.ts                  # run by the Action: guild -> members -> trim -> write JSON
  validate-requirements.ts # checks totals and name resolution
.github/workflows/sync.yml # weekly schedule + workflow_dispatch
```

## Hard rules

1. **Requirements data is authoritative and validated.** Every planet must sum to exactly 90 slots. The phase total for a unit must equal the sum of its three planet counts. `scripts/validate-requirements.ts` must pass before any commit that touches `data/`.
2. **Match units by `base_id`, never by display name at runtime.** Sheet names are resolved to swgoh.gg `base_id` once, at build or validation time, using the swgoh.gg unit catalogs plus `data/unit-aliases.json`. Any unresolved name fails validation loudly.
3. **Matching logic lives in pure functions** in `lib/matching.ts` and `lib/status.ts` with unit tests. UI code never recomputes it.
4. **Be a polite API client.** swgoh.gg is a free community service. Max 3 concurrent requests, a descriptive `User-Agent`, and the manual refresh has a cooldown (see BUILD.md). Never fetch player data from the browser.
5. **Membership comes from the guild profile on every sync.** Never carry over players who are no longer in `members[]`. Failed fetches for current members reuse old data marked `stale`.
6. **Trim on ingest.** The player endpoint returns mods, datacrons and more. Store only the fields listed in BUILD.md §4.
7. **No em dashes in UI copy.** Use commas, colons or parentheses.

## Game rules the code must encode

- Characters: meet the requirement if `gear_level == 13` and `relic >= phase minimum`. Higher is fine.
- Ships: meet the requirement at **7 stars** (`rarity == 7`). Relic does not apply.
- Unit level (1 to 85) is ignored; gear implies it.
- Phase minimum relic: P1 R5, P2 R6, P3 R7, P4 R8, P5 R9, P6 R9.
- A player can fill a given unit **once per phase**, across all three planets. That is why the phase total, not the planet total, is the number that matters for "enough".

## Things to verify, not assume

- The exact field names and the relic offset in the swgoh.gg player payload (see BUILD.md §4). Write a fixture test from a real response before building on it.
- Name resolution. Every sheet name is one distinct unit, but several characters have multiple versions with similar names. Resolve each to its own `base_id` and never merge them: `REY` (Galactic Legend) vs `REY (SCAVENGER)` vs `REY (JEDI TRAINING)`; `ECHO` (Bad Batch) vs `CT-21-0408 "ECHO"`; `MAUL` vs `DARTH MAUL`; `BISTAN` vs `BISTAN'S U-WING`.
- Relic offset: MrMeller's Rey (GL), Supreme Leader Kylo Ren and Leia Organa (GL) are R7 in game. That is the first fixture test.

## Commands (once scaffolded)

```
npm run dev
npm test
npm run validate      # requirements + name resolution
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
