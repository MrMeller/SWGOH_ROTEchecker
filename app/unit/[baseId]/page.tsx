import Link from "next/link";
import { notFound } from "next/navigation";
import { UnitPlanetPlan } from "@/components/PlanetPlan";
import { StatusChip } from "@/components/StatusChip";
import { Tabs } from "@/components/Tabs";
import { allUnits, getPhasePlan, getPhaseStatus, getRequirements, getSnapshot } from "@/lib/data";
import { stepsLabel } from "@/lib/format";
import { playerListForUnit } from "@/lib/matching";

export const dynamicParams = false;

export function generateStaticParams() {
  return allUnits().map((u) => ({ baseId: u.baseId }));
}

export async function generateMetadata({ params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  const unit = allUnits().find((u) => u.baseId === baseId);
  return { title: `${unit?.name ?? baseId} | RotE Platoon Tracker` };
}

export default async function UnitPage({ params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  const unit = allUnits().find((u) => u.baseId === baseId);
  if (!unit) notFound();
  const ship = unit.combatType === 2;
  const players = getSnapshot().players;
  const phases = getRequirements().phases.filter((p) => p.planets.some((pl) => pl.units.some((u) => u.baseId === baseId)));

  const tabs = phases.map((phase) => {
    const s = getPhaseStatus(phase.phase).find((x) => x.baseId === baseId)!;
    const list = playerListForUnit(baseId, unit.combatType, phase.minRelic, players);
    return {
      key: String(phase.phase),
      label: `P${phase.phase}`,
      panel: (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip status={s.status} />
              <span className="text-sm">
                <span className="text-lg font-semibold">{s.meets}</span>
                <span className="text-slate-400"> / {s.need} meet {ship ? "7★" : `R${phase.minRelic}`}</span>
              </span>
              <span className="text-sm text-slate-400">{s.owned} own it</span>
            </div>
            <p className="text-xs text-slate-500">
              Each player fills this unit once per phase. Players are placed on the focus planets of the phase plan first.
            </p>
            <UnitPlanetPlan planets={s.planets} meets={s.meets} plan={getPhasePlan(phase.phase)} />
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-300">Meets requirement ({list.meets.length})</h2>
            {list.meets.length ? (
              <div className="flex flex-wrap gap-1.5">
                {list.meets.map((c) => (
                  <Link
                    key={c.allyCode}
                    href={`/player/${c.allyCode}?phase=${phase.phase}`}
                    className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
                  >
                    {c.name} <span className="font-mono text-emerald-400">{c.label}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nobody yet.</p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-300">Owned, not there yet ({list.closest.length})</h2>
            {list.closest.length ? (
              <ol className="divide-y divide-slate-800 overflow-hidden rounded-xl bg-slate-900/60 ring-1 ring-slate-800">
                {list.closest.map((c, i) => (
                  <li key={c.allyCode} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="w-6 text-right text-xs text-slate-500">{i + 1}</span>
                    <Link href={`/player/${c.allyCode}?phase=${phase.phase}`} className="min-w-0 flex-1 truncate hover:underline">
                      {c.name}
                    </Link>
                    {c.needsStars && <span className="text-xs text-amber-300">needs stars</span>}
                    {c.stale && <span className="text-xs text-amber-300">old data</span>}
                    <span className="w-12 text-right font-mono">{c.label}</span>
                    <span className="w-24 text-right text-xs text-slate-500">{stepsLabel(c.distance, ship)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">Nobody.</p>
            )}
          </section>

          <p className="text-sm text-slate-500">{list.notOwned} players do not own it.</p>
        </div>
      ),
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-sm text-sky-400 hover:underline">← Overview</Link>
        <h1 className="mt-2 text-xl font-semibold">{unit.name}</h1>
        <p className="text-sm text-slate-400">
          {ship ? "Ship, needs 7 stars" : "Character, needs G13 and the phase relic"}. Needed in{" "}
          {phases.map((p) => `P${p.phase}`).join(", ")}.
        </p>
      </div>
      <Tabs tabs={tabs} queryParam="phase" />
    </div>
  );
}
