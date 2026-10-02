# Status

Where the RotE Platoon Tracker stands, for picking up in a new session. Updated 2026-10-02.
Spec: `BUILD.md`. Rules for Claude Code: `CLAUDE.md`.

## Live

- Production: https://swgohrotechecker.vercel.app (Vercel, deploys from `main`)
- Repo: https://github.com/MrMeller/SWGOH_ROTEchecker (squash merges, head branches auto-delete)
- Running on **demo data** (`data/snapshots/demo.json`: MrMeller's real roster plus 40 generated "Demo Player" rosters). A yellow banner says so. The site switches to real data automatically once `data/snapshots/latest.json` exists.
- All 8 PRs merged. 69 tests pass, `npm run validate` passes, build is clean (370 static pages).

## Done

| Area | State |
|---|---|
| Requirements data | `data/rote-platoons.json` from the swgoh.gg platoon board: 6 phases, 20 planets (incl. bonus planets Zeffo P3 and Mandalore P4), 6 platoons × 15 units each, 293 units. Per-planet counts derived at build time. June sheet kept as reference only (2 known unit swaps, listed by `npm run validate`). |
| swgoh.gg client | `lib/swgoh.ts`: bot key in `x-gg-bot-access`, 1 request/second, descriptive User-Agent, clear errors for Cloudflare challenge / rejected key. Relic offset 2 confirmed by fixture test. Trim keeps only g/r/s for required units (1933 KB raw to 7.5 KB). |
| Sync logic | `lib/sync.ts`: `buildSnapshot` (membership from guild profile, failed members reuse old data as `stale`, departed members dropped) and `runSync` (paced fetching). `npm run sync` writes `latest.json` plus a dated copy; needs `SWGOH_GG_API_KEY`. Tested against a fake swgoh.gg, **not yet against the live API**. |
| Matching and status | `lib/matching.ts` (progress ladder, ships at 7★, closest-first sort), `lib/status.ts` (enough / planet only / short). |
| Platoon plan | `lib/plan.ts`: largest set of platoons fillable at the same time (exact branch and bound, ~1 ms per phase). Ties prefer regular over bonus planets. `unitAllocation` and `platoonViews` give per-unit and per-slot detail. |
| Screens | Phase overview (summary bar, phase plan cards with six platoon pills per planet, units table with per-planet placed/required cells behind a toggle, short-only toggle, tap-a-planet sort), planet board page (6 platoons in game order, portraits, red ring on lacking slots), unit page (per-phase tabs, planet cards, ranked players), focus list with Discord copy, player search and "what should I gear" page. Mobile first. |
| Memory per browser | Short-only toggle, planet distribution toggle (off by default), last viewed phase (back links return to it). |
| Vercel | Web Analytics and Speed Insights installed. |

## Blocked

**swgoh.gg API key.** Cloudflare blocks every non-browser request (also `fetch()` from a swgoh.gg page), so the sync cannot run without a bot access key. MrMeller applied for one on swgoh.gg (application text and usage estimate were drafted in chat). Manual/browser workarounds were tried and deliberately removed. Fallback if the key is refused: self-hosted swgoh-comlink, which only needs `lib/swgoh.ts` rewritten.

## Next

1. **When the key is approved:** add it on GitHub as the Actions secret `SWGOH_GG_API_KEY` (never in the repo or Vercel). Then build step 5 of BUILD.md §8:
   - `.github/workflows/sync.yml`: weekly schedule (Sunday 03:00 UTC) plus `workflow_dispatch`, runs `npm run sync`, commits `latest.json` and the dated copy, push triggers Vercel.
   - `app/api/refresh/route.ts`: triggers `workflow_dispatch` via the GitHub API with a fine-grained token (Vercel env var), 6-hour cooldown checked against `syncedAt`. Enable the currently disabled Refresh button.
   - First live run: check the fixture assumptions against the real responses, measure sync time, then compare the overview numbers with the June sheet as the step 6 sanity check.
   - Remove the demo banner path once real data is in (or keep demo as a fallback for local dev).
2. **UX ideas parked, in rough priority:**
   - Focus list ordered by the platoon plan (units whose gearing opens the most platoons first), and the Discord text to match.
   - Planet page: a "to open more platoons here" summary at the top (distinct lacking units with how many more players each needs).
   - Overview "short for N platoons here" cells linking straight to the planet board.
   - Player page tied to the plan (units where you help open platoons first).
   - Optional: toggle to exclude a bonus planet from the plan when the guild will not unlock it.
3. **Known reading rule, decided to leave as is:** a unit can show "1 short" in the have / need total with no red ring on any board, when its spare players cover every open platoon on its own (e.g. Boba Fett, Scion of Jango in P2). Rings and "short for N platoons" are the near-term gear list; the total is the long-term one. The "+N spare" hint marks this.
4. v1.1: progress chart from the dated snapshots (BUILD.md §6.5).

## Housekeeping

- The repo lives in `~/Documents`, which iCloud syncs. It keeps creating duplicate files named like `file 2.ts` (ignored by git via `* [2-9].*`, but they break `tsc` when they land in `.next/`). Delete with `find . -path ./node_modules -prune -o -name "* [2-9].*" -print -delete`, or move the repo out of `~/Documents`.
- Vercel occasionally drops the push event for a merge to `main` (happened once). Fix: Redeploy in the Vercel dashboard or push an empty commit.
- Local dev: `npm run dev`; the Claude preview config in `.claude/launch.json` is untracked.
