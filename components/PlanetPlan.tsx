import Link from "next/link";
import { phasePlanSentence, unitPlanSentence } from "@/lib/format";
import { unitAllocation, type Fill, type PhasePlan } from "@/lib/plan";
import { planetSlug, type Phase, type Planet } from "@/lib/requirements";
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
 * Six flat pills, one per platoon: filled in the planet colour when the plan fills it on
 * day 1, half filled when it fills on a later day, an outline when it stays open.
 * `undefined` marks a platoon that does not apply (faded).
 */
export function PlatoonPills({
  platoons,
  alignment,
  className = "",
}: {
  platoons: readonly (Fill | undefined)[];
  alignment: Planet["alignment"];
  className?: string;
}) {
  const filled = platoons.filter(Boolean).length;
  const later = platoons.filter((p) => p === "later").length;
  const applies = platoons.filter((p) => p !== undefined).length;
  const style = PLANET_STYLE[alignment];
  return (
    <div
      role="img"
      aria-label={`${filled} of ${applies} platoons filled${later ? `, ${later} on a later day` : ""}`}
      className={`grid grid-cols-6 gap-1 ${className}`}
    >
      {platoons.map((p, i) => (
        <span
          key={i}
          className={`relative h-1.5 overflow-hidden rounded-full ${
            p === undefined
              ? "bg-slate-800"
              : p === "day1"
                ? style.bar
                : `ring-1 ring-inset ${style.ring} ${p ? "" : "opacity-70"}`
          }`}
        >
          {p === "later" && <span className={`absolute inset-y-0 left-0 w-1/2 ${style.bar}`} />}
        </span>
      ))}
    </div>
  );
}

/** Links to the planet page (board view of its six platoons). */
function PlanetCard({ planet, phase, children }: { planet: PlanetMeta; phase: number; children: React.ReactNode }) {
  const style = PLANET_STYLE[planet.alignment];
  return (
    <Link
      href={`/phase/${phase}/planet/${planetSlug(planet.name)}`}
      className={`block rounded-lg border-t-4 ${style.accent} bg-slate-900 p-2 text-center ring-1 ring-slate-800 transition hover:bg-slate-800 hover:ring-slate-600`}
    >
      <p className={`text-xs leading-tight font-semibold break-words ${style.text}`}>{planet.name}</p>
      <PlanetTag planet={planet} />
      {children}
    </Link>
  );
}

const gridCols = (n: number) => (n > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3");

/** Phase level: per planet, how many of its six platoons the plan fills. */
export function PhasePlanCard({ plan, planets, phase }: { plan: PhasePlan; planets: PlanetMeta[]; phase: number }) {
  return (
    <div>
      <div className={`grid gap-2 ${gridCols(planets.length)}`}>
        {planets.map((meta) => {
          const p = plan.planets.find((x) => x.planet === meta.name)!;
          return (
            <PlanetCard key={meta.name} planet={meta} phase={phase}>
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
            <PlanetCard key={a.planet} planet={meta} phase={phase.phase}>
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
