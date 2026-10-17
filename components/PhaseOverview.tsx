import Link from "next/link";
import { getMissionStatus, getPhase, getPhasePlan, getPhaseStatus, getSnapshot, missionsOn } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { sparePlacements, unitAllocation } from "@/lib/plan";
import { planetSlug } from "@/lib/requirements";
import { DAYS_OPTIONS, type Days } from "@/lib/status";
import { DaysVariants } from "./Days";
import { RememberPhase } from "./PhaseLink";
import { PhaseSwitcher } from "./PhaseSwitcher";
import { PhaseTable, type TablePlanet, type TableRow } from "./PhaseTable";
import { UNLOCK_STYLE } from "./MissionCard";
import { PhasePlanCard } from "./PlanetPlan";

const CODE: Record<string, string> = { "Dark Side": "DS", Mixed: "Mix", "Light Side": "LS" };

/** One line per special mission on the planet: members ready, and the unlock it feeds. */
function MissionNotes({ phase, planet }: { phase: number; planet: string }) {
  const missions = missionsOn(phase, planet);
  if (!missions.length) return null;
  return (
    <div className="mt-2 space-y-0.5 border-t border-slate-800 pt-1.5">
      {missions.map((m) => {
        const s = getMissionStatus(m);
        const tone = s.unlock ? UNLOCK_STYLE[s.unlock.status].className.split(" ")[1] : "text-slate-200";
        return (
          <p key={m.id} className="text-[11px] leading-tight text-slate-500" title={m.title}>
            Mission <span className={tone}>{s.ready.length}</span> ready{s.unlock ? `, ${s.unlock.wins} unlock ${s.unlock.planet}` : ""}
          </p>
        );
      })}
    </div>
  );
}

export function PhaseOverview({ phase: n }: { phase: number }) {
  const phase = getPhase(n)!;
  const snapshot = getSnapshot();

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

      <DaysVariants
        className="-mt-2"
        variants={Object.fromEntries(DAYS_OPTIONS.map((d) => [d, <PhaseBody key={d} phase={n} days={d} />])) as Record<Days, React.ReactNode>}
      />
    </div>
  );
}

/** Everything that depends on how many days the guild plays the phase. */
function PhaseBody({ phase: n, days }: { phase: number; days: Days }) {
  const phase = getPhase(n)!;
  const status = getPhaseStatus(n, days);
  const plan = getPhasePlan(n, days);
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
          {days > 1 && <span><span className="text-amber-200">{count("days")}</span> over {days} days</span>}
          <span><span className="text-rose-300">{count("short")}</span> short</span>
          <Link href={`/phase/${n}/focus`} className="ml-auto text-sky-400 hover:underline">
            Focus list →
          </Link>
        </div>
      </section>

      <section className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
        <h2 className="mb-1 text-sm font-semibold text-slate-300">Phase plan</h2>
        <p className="mb-2 text-xs text-slate-500">
          A platoon only scores when all 15 slots are filled. Each player places a unit once per day, and platoons stay
          open across the daily reset, so over {days === 1 ? "one day" : `${days} days`} the plan is the largest set of
          platoons we can fill{days > 1 ? ", with the day-1 platoons first" : " at the same time"}. Tap a planet for its board.
        </p>
        <PhasePlanCard
          plan={plan}
          planets={phase.planets}
          phase={n}
          notes={Object.fromEntries(phase.planets.map((p) => [p.name, <MissionNotes key={p.name} phase={n} planet={p.name} />]))}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Units</h2>
        <PhaseTable phase={n} days={days} planets={planets} rows={rows} />
      </section>
    </div>
  );
}
