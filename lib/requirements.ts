// Requirements dataset. Source of truth: data/rote-platoons.json (every platoon's 15 units,
// read from the swgoh.gg board). Per-planet counts are derived from it. The June 2026 sheet
// (data/rote_raw.txt) is kept for reference only. Pure functions; IO lives in the scripts.

export const PLATOONS_PER_PLANET = 6;
export const SLOTS_PER_PLATOON = 15;
export const SLOTS_PER_PLANET = PLATOONS_PER_PLANET * SLOTS_PER_PLATOON;

export type CombatType = 1 | 2; // 1 = character, 2 = ship
export type Alignment = "Dark Side" | "Mixed" | "Light Side";

export interface CatalogUnit {
  name: string;
  base_id: string;
  combat_type: number;
}

// ---- rote-platoons.json ----

export interface PlatoonPlanet {
  name: string;
  alignment: Alignment;
  /** Bonus planets (Zeffo, Mandalore) need to be unlocked first. */
  bonus: boolean;
  /** Six platoons, each a list of 15 base_ids. A unit can appear more than once. */
  platoons: string[][];
}

export interface PlatoonData {
  source: string;
  phases: { phase: number; minRelic: number; planets: PlatoonPlanet[] }[];
}

// ---- Derived requirements (what the app works with) ----

export interface RequirementUnit {
  baseId: string;
  /** In-game display name from the swgoh.gg catalog. */
  name: string;
  combatType: CombatType;
  /** Slots for this unit on this planet, across its six platoons. */
  required: number;
}

export interface Planet {
  name: string;
  alignment: Alignment;
  bonus: boolean;
  units: RequirementUnit[];
  /** The six platoons, each a list of 15 base_ids. */
  platoons: string[][];
}

export interface Phase {
  phase: number;
  minRelic: number;
  planets: Planet[];
}

export interface Requirements {
  phases: Phase[];
}

export function checkPlatoons(data: PlatoonData, catalog: readonly CatalogUnit[]): string[] {
  const known = new Set(catalog.map((u) => u.base_id));
  const errors: string[] = [];
  const phases = data.phases.map((p) => p.phase);
  if (phases.join() !== "1,2,3,4,5,6") errors.push(`Expected phases 1 to 6, got ${phases.join(", ")}`);
  for (const phase of data.phases) {
    if (!Number.isInteger(phase.minRelic)) errors.push(`P${phase.phase}: missing minRelic`);
    for (const planet of phase.planets) {
      const where = `P${phase.phase} ${planet.name}`;
      if (planet.platoons.length !== PLATOONS_PER_PLANET) {
        errors.push(`${where}: ${planet.platoons.length} platoons, expected ${PLATOONS_PER_PLANET}`);
      }
      planet.platoons.forEach((platoon, i) => {
        if (platoon.length !== SLOTS_PER_PLATOON) {
          errors.push(`${where} platoon ${i + 1}: ${platoon.length} units, expected ${SLOTS_PER_PLATOON}`);
        }
        for (const id of platoon) if (!known.has(id)) errors.push(`${where} platoon ${i + 1}: unknown base_id ${id}`);
      });
    }
  }
  return errors;
}

const ALIGNMENT_RANK: Record<Alignment, number> = { "Dark Side": 0, Mixed: 1, "Light Side": 2 };

/** Display order as on the in-game map: Dark Side, Mixed, Light Side, then bonus planets. */
export function byMapOrder(a: Pick<Planet, "alignment" | "bonus">, b: Pick<Planet, "alignment" | "bonus">): number {
  return Number(a.bonus) - Number(b.bonus) || ALIGNMENT_RANK[a.alignment] - ALIGNMENT_RANK[b.alignment];
}

/** Counts per planet from the platoons, most needed first; planets in map order. */
export function buildRequirements(data: PlatoonData, catalog: readonly CatalogUnit[]): Requirements {
  const byId = new Map(catalog.map((u) => [u.base_id, u]));
  return {
    phases: data.phases.map((phase) => ({
      phase: phase.phase,
      minRelic: phase.minRelic,
      planets: [...phase.planets].sort(byMapOrder).map((planet) => {
        const counts = new Map<string, number>();
        for (const id of planet.platoons.flat()) counts.set(id, (counts.get(id) ?? 0) + 1);
        const units = [...counts].map(([baseId, required]) => {
          const c = byId.get(baseId);
          if (!c) throw new Error(`Unknown base_id ${baseId} on ${planet.name}; run npm run validate`);
          return { baseId, name: c.name, combatType: (c.combat_type === 2 ? 2 : 1) as CombatType, required };
        });
        units.sort((a, b) => b.required - a.required || a.name.localeCompare(b.name));
        return { name: planet.name, alignment: planet.alignment, bonus: planet.bonus, units, platoons: planet.platoons };
      }),
    })),
  };
}

/** Every base_id any platoon needs. */
export function wantedUnits(data: PlatoonData): Set<string> {
  return new Set(data.phases.flatMap((p) => p.planets.flatMap((pl) => pl.platoons.flat())));
}

// ---- The June 2026 sheet (reference only) ----

/** Rows from rote_raw.txt: "NAME planetReq phaseReq guildHas guildMeets" under "@<phase> <DS|MX|LS>". */
export interface RawRow {
  phase: number;
  alignment: Alignment;
  name: string;
  planetReq: number;
  phaseReq: number;
  /** Guild members owning / meeting the unit when the sheet was made (50 members). */
  guildHas: number;
  guildMeets: number;
}

const RAW_ALIGNMENT: Record<string, Alignment> = { DS: "Dark Side", MX: "Mixed", LS: "Light Side" };

export function parseRaw(text: string): RawRow[] {
  const rows: RawRow[] = [];
  let phase = 0;
  let alignment: Alignment = "Dark Side";
  for (const line of text.split("\n").map((l) => l.trim())) {
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^@(\d+)\s+(\S+)$/);
    if (header) {
      phase = Number(header[1]);
      alignment = RAW_ALIGNMENT[header[2]];
      continue;
    }
    const m = line.match(/^(.*\S)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/);
    if (!m) throw new Error(`Unparseable line in rote_raw.txt: "${line}"`);
    rows.push({
      phase,
      alignment,
      name: m[1],
      planetReq: Number(m[2]),
      phaseReq: Number(m[3]),
      guildHas: Number(m[4]),
      guildMeets: Number(m[5]),
    });
  }
  return rows;
}

/** Normalise for exact name matching: case, quotes, apostrophes, hyphens and spaces. No fuzzy matching. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9()]/g, "");
}

/** Sheet name -> base_id, by exact normalised catalog name. */
export function sheetNameIndex(catalog: readonly CatalogUnit[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const u of catalog) index.set(normalizeName(u.name), u.base_id);
  return index;
}

export function sheetBaseId(index: Map<string, string>, name: string): string | undefined {
  return index.get(normalizeName(name));
}

/** Differences between the platoon data and the June sheet, per regular planet. Informational. */
export function sheetDifferences(req: Requirements, raw: readonly RawRow[], catalog: readonly CatalogUnit[]): string[] {
  const index = sheetNameIndex(catalog);
  const out: string[] = [];
  for (const phase of req.phases) {
    for (const planet of phase.planets.filter((p) => !p.bonus)) {
      const sheet = new Map<string, number>();
      for (const r of raw.filter((r) => r.phase === phase.phase && r.alignment === planet.alignment)) {
        const id = sheetBaseId(index, r.name);
        if (!id) out.push(`P${phase.phase} ${planet.name}: sheet name "${r.name}" matches no unit`);
        else sheet.set(id, r.planetReq);
      }
      const board = new Map(planet.units.map((u) => [u.baseId, u.required]));
      for (const id of new Set([...board.keys(), ...sheet.keys()])) {
        const b = board.get(id) ?? 0;
        const s = sheet.get(id) ?? 0;
        if (b !== s) out.push(`P${phase.phase} ${planet.name}: ${id} ${b} (sheet had ${s})`);
      }
    }
  }
  return out;
}
