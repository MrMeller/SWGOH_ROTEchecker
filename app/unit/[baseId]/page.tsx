import Link from "next/link";
import { notFound } from "next/navigation";
import { DaysVariants } from "@/components/Days";
import { UnitPlanetPlan } from "@/components/PlanetPlan";
import { PhaseLink } from "@/components/PhaseLink";
import { StatusChip } from "@/components/StatusChip";
import { Tabs } from "@/components/Tabs";
import { getPhasePlan, getPhaseStatus, getRequirements, getSnapshot, missionHref, missionsForUnit, pageUnits, unitName, type UnitMission } from "@/lib/data";
import { laterDays, stepsLabel } from "@/lib/format";
import { playerListForUnit, type UnitPlayerList } from "@/lib/matching";
import { missionRequirement, missionTabKey, rewardText } from "@/lib/missions";
import type { Phase } from "@/lib/requirements";
import { DAYS_OPTIONS, type Days } from "@/lib/status";

export const dynamicParams = false;

export function generateStaticParams() {
  return pageUnits().map((u) => ({ baseId: u.baseId }));
}

export async function generateMetadata({ params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  const unit = pageUnits().find((u) => u.baseId === baseId);
  return { title: `${unit?.name ?? baseId} | RotE Platoon Tracker` };
}

/** Status, numbers and platoon plan for one unit in one phase, under the plan for `days` days. */
function UnitStatus({ phase, baseId, ship, days }: { phase: Phase; baseId: string; ship: boolean; days: Days }) {
  const s = getPhaseStatus(phase.phase, days).find((x) => x.baseId === baseId)!;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip status={s.status} />
        <span className="text-sm">
          <span className="text-lg font-semibold">{s.meets}</span>
          <span className="text-slate-400"> / {s.need} meet {ship ? "7★" : `R${phase.minRelic}`}</span>
        </span>
        <span className="text-sm text-slate-400">{s.owned} own it</span>
      </div>
      <p className="text-xs text-slate-500">
        {days > 1
          ? `Each player places this unit once per day, so ${s.floor} players fill all ${s.need} slots over ${days} days. `
          : "Each player places this unit once. "}
        Pills show the platoons this unit is in: filled when the phase plan fills that platoon{days > 1 ? `, half when it fills on ${laterDays(days)}` : ""}.
      </p>
      <UnitPlanetPlan phase={phase} plan={getPhasePlan(phase.phase, days)} baseId={baseId} meets={s.meets} />
    </>
  );
}

/** Members who meet the relic (or 7 stars), then the owners closest first. `phase` sets the player page tab. */
function PlayerLists({ list, phase, ship }: { list: UnitPlayerList; phase: number; ship: boolean }) {
  return (
    <>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Meets requirement ({list.meets.length})</h2>
        {list.meets.length ? (
          <div className="flex flex-wrap gap-1.5">
            {list.meets.map((c) => (
              <Link
                key={c.allyCode}
                href={`/player/${c.allyCode}?phase=${phase}`}
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
                <Link href={`/player/${c.allyCode}?phase=${phase}`} className="min-w-0 flex-1 truncate hover:underline">
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
    </>
  );
}

/** One special mission the unit counts for: what the mission asks, then members at its relic. */
function MissionPanel({ um, baseId, name }: { um: UnitMission; baseId: string; name: string }) {
  const m = um.mission;
  const list = playerListForUnit(baseId, 1, m.minRelic, getSnapshot().players);
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl bg-violet-500/5 p-4 ring-1 ring-violet-400/30">
        <p className="text-xs font-medium tracking-wide text-violet-300 uppercase">Special mission, phase {m.phase}</p>
        <Link href={missionHref(m)} className="block font-semibold hover:underline">
          {m.planet}: {m.title} →
        </Link>
        <p className="text-sm text-slate-300">{missionRequirement(m, (id) => unitName(id))}.</p>
        <p className="text-sm text-slate-400">
          {um.role === "named" ? `The mission names ${name}: a member needs it at R${m.minRelic} to play.` : `${name} counts as one of the squad.`}{" "}
          One attempt per member, {rewardText(m.reward)}
          {m.unlocks ? `, ${m.unlocks.wins} wins unlock ${m.unlocks.planet}` : ""}.
        </p>
        <p className="text-sm">
          <span className="text-lg font-semibold">{list.meets.length}</span>
          <span className="text-slate-400"> members have it at R{m.minRelic}</span>
        </p>
      </div>
      <PlayerLists list={list} phase={m.phase} ship={false} />
    </div>
  );
}

export default async function UnitPage({ params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  const unit = pageUnits().find((u) => u.baseId === baseId);
  if (!unit) notFound();
  const ship = unit.combatType === 2;
  const players = getSnapshot().players;
  const phases = getRequirements().phases.filter((p) => p.planets.some((pl) => pl.units.some((u) => u.baseId === baseId)));

  const missions = missionsForUnit(baseId);

  const platoonTabs = phases.map((phase) => {
    const list = playerListForUnit(baseId, unit.combatType, phase.minRelic, players);
    return {
      key: String(phase.phase),
      label: `P${phase.phase}`,
      panel: (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
            <DaysVariants
              variants={
                Object.fromEntries(
                  DAYS_OPTIONS.map((d) => [d, <UnitStatus key={d} phase={phase} baseId={baseId} ship={ship} days={d} />]),
                ) as Record<Days, React.ReactNode>
              }
            />
          </div>

          <PlayerLists list={list} phase={phase.phase} ship={ship} />
        </div>
      ),
      sort: phase.phase,
    };
  });
  const missionTabs = missions.map((um) => ({
    key: missionTabKey(um.mission),
    label: `P${um.mission.phase} mission`,
    panel: <MissionPanel um={um} baseId={baseId} name={unit.name} />,
    sort: um.mission.phase + 0.5,
  }));
  const tabs = [...platoonTabs, ...missionTabs].sort((x, y) => x.sort - y.sort);

  return (
    <div className="space-y-5">
      <div>
        <PhaseLink className="text-sm text-sky-400 hover:underline">← Overview</PhaseLink>
        <h1 className="mt-2 text-xl font-semibold">{unit.name}</h1>
        <p className="text-sm text-slate-400">
          {ship ? "Ship, needs 7 stars" : `Character, needs G13 and the ${phases.length ? "phase" : "mission"} relic`}.{" "}
          {phases.length ? `Platoons in ${phases.map((p) => `P${p.phase}`).join(", ")}.` : "Not in any platoon."}{" "}
          {missions.length > 0 &&
            `Special ${missions.length === 1 ? "mission" : "missions"}: ${missions.map((um) => `${um.mission.planet} (P${um.mission.phase})`).join(", ")}.`}
        </p>
      </div>
      <Tabs tabs={tabs} queryParam="phase" />
    </div>
  );
}
