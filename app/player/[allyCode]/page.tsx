import Link from "next/link";
import { notFound } from "next/navigation";
import { DaysVariants } from "@/components/Days";
import { StatusChip } from "@/components/StatusChip";
import { Tabs } from "@/components/Tabs";
import { getFocus, getPhase, getSnapshot, PHASES, unitName } from "@/lib/data";
import { recommendationsFor } from "@/lib/focus";
import { stepsLabel } from "@/lib/format";
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
    </div>
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
                  {stepsLabel(c.distance, ship)}. You are #{rank} of the {unit.gap} the guild still needs
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
