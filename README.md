# RotE Platoon Tracker (DutchJedi)

Web app that shows, per phase of the SWGOH Rise of the Empire territory battle, which platoon units the DutchJedi guild has enough of, and which members are closest to meeting the requirement for the units we are short of.

- Product spec: [BUILD.md](BUILD.md)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)
- Platoon requirements: [data/rote-requirements.json](data/rote-requirements.json), transcribed from the guild sheet by Jim Petron & Mhann

Roster data comes from the public [swgoh.gg](https://swgoh.gg) API, synced weekly by a GitHub Action.
