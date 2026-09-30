# RotE Platoon Tracker (DutchJedi)

Web app that shows, per phase of the SWGOH Rise of the Empire territory battle, which platoon units the DutchJedi guild has enough of, and which members are closest to meeting the requirement for the units we are short of.

- Product spec: [BUILD.md](BUILD.md)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)
- Platoon requirements: [data/rote-platoons.json](data/rote-platoons.json), every platoon's 15 units from the [swgoh.gg platoon board](https://swgoh.gg/territory-battles/t05D/platoons/?view=board), including the bonus planets Zeffo and Mandalore. The original guild sheet by Jim Petron & Mhann is kept in [data/rote_raw.txt](data/rote_raw.txt).

Roster data comes from the [swgoh.gg](https://swgoh.gg) API (bot access key required), synced weekly by a GitHub Action. Until the first real sync, the site runs on generated demo data (`data/snapshots/demo.json`).

## Commands

```
npm run dev        # local site
npm test           # unit tests
npm run validate   # platoon data structure + unit base_ids
npm run demo       # regenerate the demo snapshot
npm run sync       # fetch the guild into data/snapshots/latest.json (needs SWGOH_GG_API_KEY)
```
