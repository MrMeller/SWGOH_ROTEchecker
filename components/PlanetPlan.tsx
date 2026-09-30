import { phasePlanSentence, unitPlanSentence } from "@/lib/format";
import { allocateUnit, type PhasePlan } from "@/lib/plan";
import type { Planet } from "@/lib/requirements";
import { PLANET_STYLE } from "./planets";

type PlanetMeta = Pick<Planet, "name" | "alignment" | "bonus">;

export function PlanetTag({ planet }: { planet: PlanetMeta }) {
  const short = PLANET_STYLE[planet.alignment].short;
  return (
    <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
      {planet.bonus ? `Bonus, ${short}` : short}
    </span>
  );
}

function PlanetCard({
  planet,
  value,
  total,
  unitLabel,
  focus,
}: {
  planet: PlanetMeta;
  value: number;
  total: number;
  unitLabel: string;
  focus: boolean;
}) {
  const style = PLANET_STYLE[planet.alignment];
  if (!total) {
    return (
      <div className="rounded-lg border-t-4 border-t-slate-700 bg-slate-900/40 p-2 text-center">
        <p className="text-xs font-semibold break-words text-slate-500">{planet.name}</p>
        <p className="mt-2 text-xs text-slate-600">Not needed</p>
      </div>
    );
  }
  const full = value >= total;
  return (
    <div
      className={`relative rounded-lg border-t-4 ${style.accent} p-2 text-center ${
        focus ? `bg-slate-800 ring-2 ${style.ring}` : "bg-slate-900 ring-1 ring-slate-800"
      }`}
    >
      {focus && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold tracking-wide text-slate-900 uppercase">
          Focus
        </span>
      )}
      <p className={`text-xs leading-tight font-semibold break-words ${style.text}`}>{planet.name}</p>
      <PlanetTag planet={planet} />
      <p className="mt-1 text-lg leading-tight font-semibold tabular-nums">
        {value}
        <span className="text-sm font-normal text-slate-500"> / {total}</span>
      </p>
      <p className="text-[11px] text-slate-500">{unitLabel}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700/60">
        <div className={`h-full ${full ? style.bar : "bg-slate-400"}`} style={{ width: `${Math.min(100, (value / total) * 100)}%` }} />
      </div>
    </div>
  );
}

const gridCols = (n: number) => (n > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3");

/** Phase level: every planet in display order with how full the plan gets it. */
export function PhasePlanCard({ plan, planets }: { plan: PhasePlan; planets: PlanetMeta[] }) {
  return (
    <div>
      <div className={`grid gap-2 pt-2 ${gridCols(planets.length)}`}>
        {planets.map((meta) => {
          const p = plan.planets.find((x) => x.planet === meta.name);
          return (
            <PlanetCard key={meta.name} planet={meta} value={p?.filled ?? 0} total={p?.slots ?? 0} unitLabel="slots filled" focus={!!p?.focus} />
          );
        })}
      </div>
      <p className="mt-2 text-sm text-slate-300">{phasePlanSentence(plan)}</p>
    </div>
  );
}

/** Unit level: where this unit's meeting players go under the phase plan. */
export function UnitPlanetPlan({
  unitPlanets,
  meets,
  plan,
  planets,
}: {
  unitPlanets: { planet: string; required: number }[];
  meets: number;
  plan: PhasePlan;
  planets: PlanetMeta[];
}) {
  const alloc = allocateUnit(unitPlanets, meets, plan.focus, planets.map((p) => p.name));
  return (
    <div>
      <div className={`grid gap-2 pt-2 ${gridCols(planets.length)}`}>
        {alloc.map((a, i) => (
          <PlanetCard
            key={a.planet}
            planet={planets[i]}
            value={a.placed}
            total={a.required}
            unitLabel="players placed"
            focus={a.focus && a.required > 0}
          />
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-300">{unitPlanSentence(alloc)}</p>
    </div>
  );
}
