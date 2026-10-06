# Status

Where the RotE Platoon Tracker stands, for picking up in a new session. Updated 2026-10-06.
Spec: `BUILD.md`. Rules for Claude Code: `CLAUDE.md`.

## Live

- Production: https://swgohrotechecker.vercel.app (Vercel, deploys from `main`)
- Repo: https://github.com/MrMeller/SWGOH_ROTEchecker (squash merges, head branches auto-delete)
- Running on **real guild data** since 2026-10-02 17:17 CEST: the first live "Sync roster" run fetched all 41 members fresh in 53 s, committed `latest.json` plus `2026-10-02.json` (340 KB) and Vercel deployed it. The demo snapshot stays as the local fallback when `latest.json` is absent.
- 12 PRs merged, plus the multi-day platoon change on `feat/multi-day-platoons` (see below). 83 tests pass, `npm run validate` passes, build is clean.

## Done

| Area | State |
|---|---|
| Requirements data | `data/rote-platoons.json` from the swgoh.gg platoon board: 6 phases, 20 planets (incl. bonus planets Zeffo P3 and Mandalore P4), 6 platoons × 15 units each, 293 units. Per-planet counts derived at build time. June sheet kept as reference only (2 known unit swaps, listed by `npm run validate`). |
| Roster client | `lib/comlink.ts` (swgoh-comlink, POST `/guild` and `/player`, clear errors for comlink error bodies and an unreachable host): 1 request/second, descriptive User-Agent, trim keeps only g/r/s for required units (2.4 MB raw to about 8 KB per player, about 300 KB per guild snapshot). Relic offset 2 confirmed by `lib/comlink.test.ts` on the reduced fixtures `data/fixtures/comlink-*.json`. The swgoh.gg client and its 2 MB fixture are removed. |
| Sync logic | `lib/sync.ts`: `buildSnapshot` (membership from the comlink guild roster keyed by `playerId`, failed members reuse old data as `stale`, departed members dropped), `snapshotChanged` (ignores `syncedAt`) and `runSync` (1 request per second). `npm run sync` writes `latest.json` plus a dated copy only when a roster changed and sets `changed` in `$GITHUB_OUTPUT`. Exercised twice against a fake comlink: write, then no change. |
| Sync workflow | `.github/workflows/sync.yml`: cron `17 1 */2 * *` plus `workflow_dispatch`, comlink 4.5.0 as a service container (a curl step polls `/readyz`; Docker health checks cannot run in the shell-less image), commits "Sync roster YYYY-MM-DD" only when `changed=true`. First live run 2026-10-02 succeeded (the first attempt failed on a Docker health check, see `docs/comlink-exploration.md`). Next scheduled runs: odd days of the month at 01:17 UTC. |
| Matching and status | `lib/matching.ts` (progress ladder, ships at 7★, closest-first sort), `lib/status.ts` (enough / over days / short, with `days` per phase: a unit is fillable when `ceil(need / days)` players meet it). |
| Platoon plan | `lib/plan.ts`: largest set of platoons fillable over `days` days (capacity `meets × days` per unit), built around the largest day-1 set (exact branch and bound, ~1 ms per phase and days value). Ties prefer regular over bonus planets. Platoons fill as `day1`, `later` or not; `unitAllocation` and `platoonViews` give per-unit and per-slot detail, with `scarce` slots for units a player places again. |
| Screens | Phase overview (summary bar, phase plan cards with six platoon pills per planet, half pills for later days, units table with per-planet placed/required cells behind a toggle, short-only toggle, tap-a-planet sort), planet board page (6 platoons in game order, portraits, orange ring on units placed again on a later day, red ring on lacking slots, "nobody" when no player meets a unit), unit page (per-phase tabs, planet cards, ranked players), focus list with Discord copy (players that make a unit fillable first), player search and "what should I gear" page. Mobile first. |
| Memory per browser | Days per phase (1, 2, 3; default 2), short-only toggle, planet distribution toggle (off by default), last viewed phase (back links return to it). Pages render every days variant on the server and `components/Days.tsx` shows the remembered one, so the site stays static. |
| Vercel | Web Analytics and Speed Insights installed. |

## Decided 2026-10-02: roster data via swgoh-comlink

swgoh.gg's API stays Cloudflare-blocked without a bot key (applied for, no answer). A local smoke test showed swgoh-comlink 4.5.0 is a drop-in source: same guild id, same relic offset, 264 of 266 required units identical to the swgoh.gg fixture (the other 2 progressed). Decisions: comlink runs as a service container inside the sync GitHub Action (nothing hosted, no keys), every 48 hours, no Refresh button, commit only when a unit changed. Spec updated in BUILD.md §4 and §7; findings and the build checklist in `docs/comlink-exploration.md`. Built and run live the same day (see Live and Done).

## Decided 2026-10-06: a player places a unit once per day, not once per phase

Observed in game: platoons of an earlier phase stay open after the next phase starts (until the planet is three-starred) and the daily reset lets a player place the same unit again. DutchJedi plays about three phases over six days, so each player has about two placements per unit per phase. Encoded as the `days` toggle: status is enough (all slots on day 1), over days (fillable in `days` days) or short; the plan fills over `days` days with the day-1 plan nested inside; the board marks units placed twice with an orange ring. Spec in BUILD.md §5.3, §5.5, §9.6 and the CLAUDE.md game rules. Built in six commits on `feat/multi-day-platoons` (spec, status, plan, toggle, focus, docs), each with tests green.

## Next

1. **After the first scheduled runs:** check in the Actions tab that the 01:17 UTC cron fired on 3 and 5 October and whether it committed (only when a roster changed). Compare the overview numbers with the June sheet once (BUILD.md §8 sanity check) and note the result here. Watch for a failing `/guild` call on a fresh runner IP; the fallback is option B in `docs/comlink-exploration.md`. After about two months, confirm GitHub has not disabled the schedule for inactivity.
2. **UX ideas parked, in rough priority:**
   - Focus list ordered by the platoon plan (units whose gearing opens the most platoons first), and the Discord text to match.
   - Planet page: a "to open more platoons here" summary at the top (distinct lacking units with how many more players each needs).
   - Overview "short for N platoons here" cells linking straight to the planet board.
   - Player page tied to the plan (units where you help open platoons first).
   - Optional: toggle to exclude a bonus planet from the plan when the guild will not unlock it.
3. **Known reading rule, decided to leave as is:** a unit can show "1 short" in the have / need total with no red ring on any board, when its spare placements cover every open platoon on its own. Rings and "short for N platoons" are the near-term gear list; the total is the long-term one. The "+N spare placements" hint (shown for units that are not green) marks this.
4. **After the multi-day change ships:** watch one territory battle with the days toggle on 2 and check that platoons marked Day 2 really complete on the second day, and that the last phase the guild reaches (which may get only one day) reads right with the toggle on 1.
5. v1.1: progress chart from the dated snapshots (BUILD.md §6.5).

## Housekeeping

- The repo lives in `~/Documents`, which iCloud syncs. It keeps creating duplicate files named like `file 2.ts` (ignored by git via `* [2-9].*`, but they break `tsc` when they land in `.next/`). Delete with `find . -path ./node_modules -prune -o -name "* [2-9].*" -print -delete`, or move the repo out of `~/Documents`.
- Vercel occasionally drops the push event for a merge to `main` (happened once). Fix: Redeploy in the Vercel dashboard or push an empty commit.
- Local dev: `npm run dev`; the Claude preview config in `.claude/launch.json` is untracked.
