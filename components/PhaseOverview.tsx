import Link from "next/link";
import { getPhase, getPhasePlan, getPhaseStatus, getSnapshot } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { unitAllocation } from "@/lib/plan";
import { PhaseSwitcher } from "./PhaseSwitcher";
import { PhasePlanCard, PlatoonPills } from "./PlanetPlan";
import { PLANET_STYLE } from "./planets";
import { ShortFilter } from "./ShortFilter";
import { StatusChip } from "./StatusChip";

export function PhaseOverview({ phase: n }: { phase: number }) {
  const phase = getPhase(n)!;
  const snapshot = getSnapshot();
  const status = getPhaseStatus(n);
  const byId = new Map(status.map((s) => [s.baseId, s]));
  const plan = getPhasePlan(n);
  const count = (k: string) => status.filter((s) => s.status === k).length;

  return (
    <div className="space-y-5">
      <PhaseSwitcher current={n} href={(p) => `/phase/${p}`} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Phase {n} <span className="text-slate-400">(R{phase.minRelic} needed)</span>
          </h1>
          <p className="text-xs text-slate-400">Data from {formatDate(snapshot.syncedAt)}</p>
        </div>
        <button
          disabled
          title="Available once the live sync is set up"
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-500"
        >
          Refresh
        </button>
      </div>

      <section className="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <p className="text-sm text-slate-300">
          <span className="text-2xl font-semibold text-white">{count("enough")}</span> of {status.length} units enough
        </p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="bg-emerald-400" style={{ width: `${(count("enough") / status.length) * 100}%` }} />
          <div className="bg-amber-300" style={{ width: `${(count("planet") / status.length) * 100}%` }} />
          <div className="bg-rose-400" style={{ width: `${(count("short") / status.length) * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <span><span className="text-emerald-300">{count("enough")}</span> enough</span>
          <span><span className="text-amber-200">{count("planet")}</span> planet only</span>
          <span><span className="text-rose-300">{count("short")}</span> short</span>
          <Link href={`/phase/${n}/focus`} className="ml-auto text-sky-400 hover:underline">
            Focus list →
          </Link>
        </div>
      </section>

      <section className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
        <h2 className="mb-1 text-sm font-semibold text-slate-300">Phase plan</h2>
        <p className="mb-2 text-xs text-slate-500">
          A platoon only scores when all 15 slots are filled, and each player fills a unit once per phase. The plan is the largest set of platoons we can fill at the same time. Bonus planets count only once unlocked.
        </p>
        <PhasePlanCard plan={plan} planets={phase.planets} />
      </section>

      <ShortFilter>
        <div className="space-y-6">
          {phase.planets.map((planet) => {
            const planetPlan = plan.planets.find((p) => p.planet === planet.name)!;
            return (
              <section key={planet.name}>
                <h2
                  className={`mb-2 flex items-baseline justify-between border-l-4 pl-2 text-sm font-semibold tracking-wide uppercase ${PLANET_STYLE[planet.alignment]?.text ?? "text-slate-300"} ${PLANET_STYLE[planet.alignment]?.border ?? "border-slate-600"}`}
                >
                  <span>
                    {planet.name}
                    <span className="ml-2 text-[11px] font-medium text-slate-500">
                      {planet.bonus ? `Bonus, ${planet.alignment}` : planet.alignment}
                    </span>
                  </span>
                  <span className="text-xs font-normal normal-case text-slate-500">
                    {planetPlan.filled} / {planetPlan.platoons.length} platoons, {planet.units.length} units
                  </span>
                </h2>
                <PlatoonPills platoons={planetPlan.platoons} alignment={planet.alignment} className="mb-3 pl-3" />
                <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl bg-slate-900/60 ring-1 ring-slate-800">
                  {planet.units.map((u) => {
                    const s = byId.get(u.baseId)!;
                    const shortFor = unitAllocation(phase, plan, u.baseId, s.meets).find((a) => a.planet === planet.name)!.shortFor;
                    return (
                      <li
                        key={u.baseId}
                        data-status={s.status}
                        className="group-data-[only-short=true]/filter:data-[status=enough]:hidden"
                      >
                        <Link
                          href={`/unit/${u.baseId}?phase=${n}`}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/60"
                        >
                          <StatusChip status={s.status} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {u.name}
                              {u.combatType === 2 && <span className="ml-1 text-xs text-slate-500">ship</span>}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {u.required} on this planet, {s.owned} own it
                              {shortFor > 0 ? (
                                <span className="text-rose-300">
                                  , short for {shortFor} platoon{shortFor === 1 ? "" : "s"} here
                                </span>
                              ) : (
                                s.status !== "enough" && <span className="text-emerald-300">, covered in the plan</span>
                              )}
                            </span>
                          </span>
                          <span className="text-right text-sm tabular-nums">
                            <span className="font-semibold">{s.meets}</span>
                            <span className="text-slate-500"> / {s.need}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </ShortFilter>
    </div>
  );
}
