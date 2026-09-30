// Requirements dataset: types, total checks and sheet-name -> base_id resolution.
// Pure functions; file IO lives in scripts/validate-requirements.ts.

export const SLOTS_PER_PLANET = 90;

export type CombatType = 1 | 2; // 1 = character, 2 = ship

export interface RequirementUnit {
  name: string;
  required: number;
  baseId?: string;
  combatType?: CombatType;
}

export interface Planet {
  alignment: string;
  units: RequirementUnit[];
}

export interface Phase {
  phase: number;
  minRelic: number;
  planets: Planet[];
}

export interface Requirements {
  source?: string;
  phases: Phase[];
}

export interface CatalogUnit {
  name: string;
  base_id: string;
  combat_type: number;
}

export type Aliases = Record<string, string>;

/** Rows from rote_raw.txt: "NAME planetReq phaseReq guildHas guildMeets" under "@<phase> <DS|MX|LS>". */
export interface RawRow {
  phase: number;
  planet: string;
  name: string;
  planetReq: number;
  phaseReq: number;
}

const RAW_PLANETS: Record<string, string> = { DS: "Dark Side", MX: "Mixed", LS: "Light Side" };

export function parseRaw(text: string): RawRow[] {
  const rows: RawRow[] = [];
  let phase = 0;
  let planet = "";
  for (const line of text.split("\n").map((l) => l.trim())) {
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^@(\d+)\s+(\S+)$/);
    if (header) {
      phase = Number(header[1]);
      planet = RAW_PLANETS[header[2]] ?? header[2];
      continue;
    }
    const m = line.match(/^(.*\S)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/);
    if (!m) throw new Error(`Unparseable line in rote_raw.txt: "${line}"`);
    rows.push({ phase, planet, name: m[1], planetReq: Number(m[2]), phaseReq: Number(m[3]) });
  }
  return rows;
}

/** Sum of a unit's counts across all planets of a phase, keyed by sheet name. */
export function phaseTotals(phase: Phase): Map<string, number> {
  const totals = new Map<string, number>();
  for (const planet of phase.planets) {
    for (const u of planet.units) totals.set(u.name, (totals.get(u.name) ?? 0) + u.required);
  }
  return totals;
}

export function checkTotals(req: Requirements, raw?: RawRow[]): string[] {
  const errors: string[] = [];
  for (const phase of req.phases) {
    for (const planet of phase.planets) {
      const sum = planet.units.reduce((a, u) => a + u.required, 0);
      if (sum !== SLOTS_PER_PLANET) {
        errors.push(`P${phase.phase} ${planet.alignment}: ${sum} slots, expected ${SLOTS_PER_PLANET}`);
      }
      const seen = new Set<string>();
      for (const u of planet.units) {
        if (seen.has(u.name)) errors.push(`P${phase.phase} ${planet.alignment}: "${u.name}" listed twice`);
        seen.add(u.name);
      }
    }
  }
  if (!raw) return errors;

  // The sheet's own phaseReq column must equal the sum of the planet counts,
  // and the JSON planet counts must match the sheet.
  for (const phase of req.phases) {
    const totals = phaseTotals(phase);
    const rows = raw.filter((r) => r.phase === phase.phase);
    for (const r of rows) {
      const planet = phase.planets.find((p) => p.alignment === r.planet);
      const unit = planet?.units.find((u) => u.name === r.name);
      if (!unit) {
        errors.push(`P${phase.phase} ${r.planet}: "${r.name}" is in rote_raw.txt but not in the JSON`);
        continue;
      }
      if (unit.required !== r.planetReq) {
        errors.push(`P${phase.phase} ${r.planet} "${r.name}": JSON ${unit.required}, sheet ${r.planetReq}`);
      }
      const total = totals.get(r.name);
      if (total !== r.phaseReq) {
        errors.push(`P${phase.phase} "${r.name}": planet counts sum to ${total}, sheet phase total ${r.phaseReq}`);
      }
    }
    for (const planet of phase.planets) {
      for (const u of planet.units) {
        if (!rows.some((r) => r.planet === planet.alignment && r.name === u.name)) {
          errors.push(`P${phase.phase} ${planet.alignment}: "${u.name}" is in the JSON but not in rote_raw.txt`);
        }
      }
    }
  }
  return errors;
}

/**
 * Normalise for exact matching only: case, quotes, apostrophes, hyphens and spaces.
 * Deliberately no fuzzy matching and no stripping of parenthesised suffixes, so
 * "REY" and "REY (SCAVENGER)" can never collapse into one unit.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9()]/g, "");
}

export interface Resolution {
  name: string;
  baseId: string;
  combatType: CombatType;
  via: "alias" | "name";
}

export interface ResolveResult {
  resolved: Map<string, Resolution>;
  unresolved: string[];
  ambiguous: { name: string; candidates: CatalogUnit[] }[];
  errors: string[];
}

export function resolveNames(names: string[], catalog: CatalogUnit[], aliases: Aliases): ResolveResult {
  const byId = new Map(catalog.map((u) => [u.base_id, u]));
  const byName = new Map<string, CatalogUnit[]>();
  for (const u of catalog) {
    const key = normalizeName(u.name);
    byName.set(key, [...(byName.get(key) ?? []), u]);
  }

  const result: ResolveResult = { resolved: new Map(), unresolved: [], ambiguous: [], errors: [] };

  for (const [alias, baseId] of Object.entries(aliases)) {
    if (!byId.has(baseId)) result.errors.push(`Alias "${alias}" points to unknown base_id "${baseId}"`);
    if (!names.includes(alias)) result.errors.push(`Alias "${alias}" is not a name in the requirements`);
  }

  for (const name of [...new Set(names)].sort()) {
    const aliased = aliases[name];
    if (aliased) {
      const unit = byId.get(aliased);
      if (unit) result.resolved.set(name, toResolution(name, unit, "alias"));
      continue;
    }
    const candidates = byName.get(normalizeName(name)) ?? [];
    if (candidates.length === 1) result.resolved.set(name, toResolution(name, candidates[0], "name"));
    else if (candidates.length === 0) result.unresolved.push(name);
    else result.ambiguous.push({ name, candidates });
  }

  // Never merge versions: two sheet names must not land on the same unit.
  const owners = new Map<string, string[]>();
  for (const r of result.resolved.values()) owners.set(r.baseId, [...(owners.get(r.baseId) ?? []), r.name]);
  for (const [baseId, sheetNames] of owners) {
    if (sheetNames.length > 1) {
      result.errors.push(`Sheet names ${sheetNames.map((n) => `"${n}"`).join(", ")} all resolve to ${baseId}`);
    }
  }
  return result;
}

function toResolution(name: string, unit: CatalogUnit, via: Resolution["via"]): Resolution {
  if (unit.combat_type !== 1 && unit.combat_type !== 2) {
    throw new Error(`Unexpected combat_type ${unit.combat_type} for ${unit.base_id}`);
  }
  return { name, baseId: unit.base_id, combatType: unit.combat_type, via };
}

export function allNames(req: Requirements): string[] {
  return req.phases.flatMap((p) => p.planets.flatMap((pl) => pl.units.map((u) => u.name)));
}

/** Returns a copy with baseId and combatType filled in for every unit. */
export function applyResolution(req: Requirements, resolved: Map<string, Resolution>): Requirements {
  return {
    ...req,
    phases: req.phases.map((p) => ({
      ...p,
      planets: p.planets.map((pl) => ({
        ...pl,
        units: pl.units.map((u) => {
          const r = resolved.get(u.name);
          if (!r) throw new Error(`No resolution for "${u.name}"`);
          return { name: u.name, required: u.required, baseId: r.baseId, combatType: r.combatType };
        }),
      })),
    })),
  };
}
