import { phasePlanSentence, unitPlanSentence } from "@/lib/format";
import { allocateUnit, PLANET_ORDER, type PhasePlan } from "@/lib/plan";
import { PLANET_STYLE } from "./planets";


function PlanetCard({
  alignment,
  value,
  total,
  unitLabel,
  focus,
}: {
  alignment: string;
  value: number;
  total: number;
  unitLabel: string;
  focus: boolean;
}) {
  const style = PLANET_STYLE[alignment];
  if (!total) {
    return (
      <div className="rounded-lg border-t-4 border-t-slate-700 bg-slate-900/40 p-2.5 text-center">
        <p className="text-xs font-semibold text-slate-500">{style.label}</p>
        <p className="mt-2 text-xs text-slate-600">Not needed</p>
      </div>
    );
  }
  const full = value >= total;
  return (
    <div
      className={`relative rounded-lg border-t-4 ${style.accent} p-2.5 text-center ${
        focus ? `bg-slate-800 ring-2 ${style.ring}` : "bg-slate-900 ring-1 ring-slate-800"
      }`}
    >
      {focus && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold tracking-wide text-slate-900 uppercase">
          Focus
        </span>
      )}
      <p className={`text-xs font-semibold ${style.text}`}>{style.label}</p>
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

/** Phase level: the three planets in map order with how full the plan gets them. */
export function PhasePlanCard({ plan }: { plan: PhasePlan }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 pt-2">
        {PLANET_ORDER.map((a) => {
          const p = plan.planets.find((x) => x.alignment === a);
          return <PlanetCard key={a} alignment={a} value={p?.filled ?? 0} total={p?.slots ?? 0} unitLabel="slots filled" focus={!!p?.focus} />;
        })}
      </div>
      <p className="mt-2 text-sm text-slate-300">{phasePlanSentence(plan)}</p>
    </div>
  );
}

/** Unit level: where this unit's meeting players go under the phase plan. */
export function UnitPlanetPlan({
  planets,
  meets,
  plan,
}: {
  planets: { alignment: string; required: number }[];
  meets: number;
  plan: PhasePlan;
}) {
  const alloc = allocateUnit(planets, meets, plan.focus);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 pt-2">
        {alloc.map((a) => (
          <PlanetCard key={a.alignment} alignment={a.alignment} value={a.placed} total={a.required} unitLabel="players placed" focus={a.focus && a.required > 0} />
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-300">{unitPlanSentence(alloc)}</p>
    </div>
  );
}
