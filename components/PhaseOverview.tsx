import Link from "next/link";
import { getPhase, getPhasePlan, getPhaseStatus, getSnapshot } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { sparePlacements, unitAllocation } from "@/lib/plan";
import { planetSlug } from "@/lib/requirements";
import { RememberPhase } from "./PhaseLink";
import { PhaseSwitcher } from "./PhaseSwitcher";
import { PhaseTable, type TablePlanet, type TableRow } from "./PhaseTable";
import { PhasePlanCard } from "./PlanetPlan";

const CODE: Record<string, string> = { "Dark Side": "DS", Mixed: "Mix", "Light Side": "LS" };

export function PhaseOverview({ phase: n }: { phase: number }) {
  const phase = getPhase(n)!;
  const snapshot = getSnapshot();
  const status = getPhaseStatus(n);
  const plan = getPhasePlan(n);
  const count = (k: string) => status.filter((s) => s.status === k).length;

  const planets: TablePlanet[] = phase.planets.map((p) => ({
    name: p.name,
    alignment: p.alignment,
    bonus: p.bonus,
    // Bonus planets share an alignment with a regular one, so they get their own code.
    code: p.bonus ? p.name.slice(0, 3) : CODE[p.alignment],
    href: `/phase/${n}/planet/${planetSlug(p.name)}`,
  }));

  const rows: TableRow[] = status.map((s) => {
    const alloc = unitAllocation(phase, plan, s.baseId, s.meets);
    return {
      baseId: s.baseId,
      name: s.name,
      ship: s.combatType === 2,
      status: s.status,
      meets: s.meets,
      need: s.need,
      spare: sparePlacements(plan, s.baseId, s.meets),
      cells: alloc.map((c) => ({ required: c.required, planned: c.planned, shortFor: c.shortFor })),
    };
  });

  return (
    <div className="space-y-5">
      <RememberPhase phase={n} />
      <PhaseSwitcher current={n} href={(p) => `/phase/${p}`} />

      <div>
        <h1 className="text-xl font-semibold">
          Phase {n} <span className="text-slate-400">(R{phase.minRelic} needed)</span>
        </h1>
        <p className="text-xs text-slate-400">Data from {formatDate(snapshot.syncedAt)}</p>
      </div>

      <section className="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <p className="text-sm text-slate-300">
          <span className="text-2xl font-semibold text-white">{count("enough")}</span> of {status.length} units enough
        </p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="bg-emerald-400" style={{ width: `${(count("enough") / status.length) * 100}%` }} />
          <div className="bg-amber-300" style={{ width: `${(count("days") / status.length) * 100}%` }} />
          <div className="bg-rose-400" style={{ width: `${(count("short") / status.length) * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <span><span className="text-emerald-300">{count("enough")}</span> enough</span>
          <span><span className="text-amber-200">{count("days")}</span> over days</span>
          <span><span className="text-rose-300">{count("short")}</span> short</span>
          <Link href={`/phase/${n}/focus`} className="ml-auto text-sky-400 hover:underline">
            Focus list →
          </Link>
        </div>
      </section>

      <section className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
        <h2 className="mb-1 text-sm font-semibold text-slate-300">Phase plan</h2>
        <p className="mb-2 text-xs text-slate-500">
          A platoon only scores when all 15 slots are filled, and each player fills a unit once per phase. The plan is the largest set of platoons we can fill at the same time. Tap a planet for its board.
        </p>
        <PhasePlanCard plan={plan} planets={phase.planets} phase={n} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Units</h2>
        <PhaseTable phase={n} planets={planets} rows={rows} />
      </section>
    </div>
  );
}
