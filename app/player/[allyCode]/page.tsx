import Link from "next/link";
import { notFound } from "next/navigation";
import { DaysVariants } from "@/components/Days";
import { CoverageNotice, UnlockChip } from "@/components/MissionCard";
import { StatusChip } from "@/components/StatusChip";
import { Tabs } from "@/components/Tabs";
import { getFocus, getMissions, getMissionStatus, getPhase, getSnapshot, missionHref, PHASES, unitName } from "@/lib/data";
import { recommendationsFor } from "@/lib/focus";
import { stepsLabel } from "@/lib/format";
import { missingText } from "@/lib/missions";
import type { TrimmedPlayer } from "@/lib/snapshot";
import { DAYS_OPTIONS, type Days } from "@/lib/status";

export const dynamicParams = false;

export function generateStaticParams() {
  return getSnapshot().players.map((p) => ({ allyCode: String(p.allyCode) }));
}

const findPlayer = (allyCode: string) => getSnapshot().players.find((p) => String(p.allyCode) === allyCode);

export async function generateMetadata({ params }: { params: Promise<{ allyCode: string }> }) {
  return { title: `${findPlayer((await params).allyCode)?.name ?? "Player"} | RotE Platoon Tracker` };
}

export default async function PlayerPage({ params }: { params: Promise<{ allyCode: string }> }) {
  const player = findPlayer((await params).allyCode);
  if (!player) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/player" className="text-sm text-sky-400 hover:underline">← All players</Link>
        <h1 className="mt-2 text-xl font-semibold">{player.name}</h1>
        <p className="text-sm text-slate-400">
          Units the guild is short on where you are one of the closest players, easiest first.
          {player.stale && <span className="text-amber-300"> Your data could not be refreshed in the last sync.</span>}
        </p>
      </div>
      <DaysVariants
        variants={Object.fromEntries(DAYS_OPTIONS.map((d) => [d, <Recommendations key={d} player={player} days={d} />])) as Record<Days, React.ReactNode>}
      />
      <PlayerMissions player={player} />
    </div>
  );
}

/** Every special mission: ready, or what this player still lacks for it. Ready first, then fewest units short. */
function PlayerMissions({ player }: { player: TrimmedPlayer }) {
  const rows = getMissions()
    .map((m) => {
      const s = getMissionStatus(m);
      const c = [...s.ready, ...s.notReady].find((x) => x.allyCode === player.allyCode)!;
      return { m, s, c };
    })
    .sort((a, b) => a.c.missing - b.c.missing || a.c.effort - b.c.effort || a.m.phase - b.m.phase);
  const ready = rows.filter((r) => r.c.ready).length;
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-300">Special missions</h2>
        <p className="text-xs text-slate-400">
          Ready for {ready} of {rows.length}. One attempt per member, so every ready member adds a win for the guild.
        </p>
      </div>
      <CoverageNotice />
      <ol className="divide-y divide-slate-800 overflow-hidden rounded-xl bg-slate-900/60 ring-1 ring-slate-800">
        {rows.map(({ m, s, c }) => (
          <li key={`${m.phase}-${m.planet}-${m.id}`} className="px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex w-22 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  c.ready
                    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
                    : c.missing <= 1
                      ? "bg-amber-400/15 text-amber-200 ring-amber-400/40"
                      : "bg-rose-500/15 text-rose-300 ring-rose-500/40"
                }`}
              >
                {c.ready ? "Ready" : `${c.missing} short`}
              </span>
              <Link href={missionHref(m)} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {m.title} <span className="text-xs font-normal text-slate-400">P{m.phase} {m.planet}</span>
              </Link>
              {s.unlock && <UnlockChip status={s.unlock.status} />}
            </div>
            {!c.ready && <p className="mt-1 text-xs text-slate-400">{missingText(c, m, (id) => unitName(id))}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Per phase, the units where this player is among the closest candidates, under the plan for `days` days. */
function Recommendations({ player, days }: { player: TrimmedPlayer; days: Days }) {
  const tabs = PHASES.map((n) => {
    const phase = getPhase(n)!;
    const recs = recommendationsFor(player.allyCode, getFocus(n, days));
    return {
      key: String(n),
      label: (
        <>
          P{n}
          {recs.length > 0 && <span className="ml-1 text-xs opacity-70">{recs.length}</span>}
        </>
      ),
      panel: recs.length ? (
        <ol className="divide-y divide-slate-800 overflow-hidden rounded-xl bg-slate-900/60 ring-1 ring-slate-800">
          {recs.map(({ unit, candidate: c, rank }) => {
            const ship = unit.combatType === 2;
            return (
              <li key={unit.baseId} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <StatusChip status={unit.status} />
                  <Link href={`/unit/${unit.baseId}?phase=${n}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {unitName(unit.baseId, unit.name)}
                  </Link>
                  <span className="font-mono text-sm">
                    {c.label} <span className="text-slate-500">→</span> {ship ? "7★" : `R${phase.minRelic}`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {stepsLabel(c.distance, ship)}.{" "}
                  {unit.days > 1 && rank <= unit.gapDays
                    ? `You are #${rank} of the ${unit.gapDays} the guild needs to fill it over ${unit.days} days`
                    : `You are #${rank} of the ${unit.gap} the guild needs to fill everything on day 1`}{" "}
                  ({unit.meets}/{unit.need} now).
                  {c.needsStars && <span className="text-amber-300"> Needs 7 stars first.</span>}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-slate-900/60 p-4 text-sm text-slate-400 ring-1 ring-slate-800">
          Nothing for you in phase {n}: the guild has enough, or other players are closer.
        </p>
      ),
    };
  });

  return <Tabs tabs={tabs} queryParam="phase" />;
}
