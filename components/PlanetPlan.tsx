import { phasePlanSentence, unitPlanSentence } from "@/lib/format";
import { unitAllocation, type PhasePlan } from "@/lib/plan";
import type { Phase, Planet } from "@/lib/requirements";
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

/**
 * Six flat pills, one per platoon: filled in the planet colour when the plan fills it,
 * an outline when it stays open. `undefined` marks a platoon that does not apply (faded).
 */
export function PlatoonPills({
  platoons,
  alignment,
  className = "",
}: {
  platoons: readonly (boolean | undefined)[];
  alignment: Planet["alignment"];
  className?: string;
}) {
  const filled = platoons.filter(Boolean).length;
  const applies = platoons.filter((p) => p !== undefined).length;
  return (
    <div
      role="img"
      aria-label={`${filled} of ${applies} platoons filled`}
      className={`grid grid-cols-6 gap-1 ${className}`}
    >
      {platoons.map((p, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full ${
            p === undefined
              ? "bg-slate-800"
              : p
                ? PLANET_STYLE[alignment].bar
                : `ring-1 ring-inset ${PLANET_STYLE[alignment].ring} opacity-70`
          }`}
        />
      ))}
    </div>
  );
}

function PlanetCard({ planet, children }: { planet: PlanetMeta; children: React.ReactNode }) {
  const style = PLANET_STYLE[planet.alignment];
  return (
    <div className={`rounded-lg border-t-4 ${style.accent} bg-slate-900 p-2 text-center ring-1 ring-slate-800`}>
      <p className={`text-xs leading-tight font-semibold break-words ${style.text}`}>{planet.name}</p>
      <PlanetTag planet={planet} />
      {children}
    </div>
  );
}

const gridCols = (n: number) => (n > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3");

/** Phase level: per planet, how many of its six platoons the plan fills. */
export function PhasePlanCard({ plan, planets }: { plan: PhasePlan; planets: PlanetMeta[] }) {
  return (
    <div>
      <div className={`grid gap-2 ${gridCols(planets.length)}`}>
        {planets.map((meta) => {
          const p = plan.planets.find((x) => x.planet === meta.name)!;
          return (
            <PlanetCard key={meta.name} planet={meta}>
              <p className="mt-1 text-lg leading-tight font-semibold tabular-nums">
                {p.filled}
                <span className="text-sm font-normal text-slate-500"> / {p.platoons.length}</span>
              </p>
              <p className="text-[11px] text-slate-500">platoons</p>
              <PlatoonPills platoons={p.platoons} alignment={meta.alignment} className="mt-2" />
            </PlanetCard>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-slate-300">{phasePlanSentence(plan)}</p>
    </div>
  );
}

/** Unit level: the platoons this unit is in, and how many players the plan places there. */
export function UnitPlanetPlan({ phase, plan, baseId, meets }: { phase: Phase; plan: PhasePlan; baseId: string; meets: number }) {
  const alloc = unitAllocation(phase, plan, baseId, meets);
  return (
    <div>
      <div className={`grid gap-2 ${gridCols(phase.planets.length)}`}>
        {alloc.map((a, i) => {
          const meta = phase.planets[i];
          return (
            <PlanetCard key={a.planet} planet={meta}>
              {a.required ? (
                <>
                  <p className="mt-1 text-lg leading-tight font-semibold tabular-nums">
                    {a.planned}
                    <span className="text-sm font-normal text-slate-500"> / {a.required}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">in planned platoons</p>
                  <PlatoonPills platoons={a.platoons} alignment={meta.alignment} className="mt-2" />
                  {a.shortFor > 0 && <p className="mt-1.5 text-[11px] text-rose-300">short for {a.shortFor}</p>}
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-600">Not needed</p>
              )}
            </PlanetCard>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-slate-300">{unitPlanSentence(alloc)}</p>
    </div>
  );
}
