import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButtons } from "@/components/CopyButtons";
import { PhaseSwitcher } from "@/components/PhaseSwitcher";
import { StatusChip } from "@/components/StatusChip";
import { getFocus, getPhase, getSnapshot, PHASES, unitName } from "@/lib/data";
import { focusToDiscord, stepsLabel } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return PHASES.map((p) => ({ phase: String(p) }));
}

export async function generateMetadata({ params }: { params: Promise<{ phase: string }> }) {
  return { title: `Phase ${(await params).phase} focus | RotE Platoon Tracker` };
}

export default async function FocusPage({ params }: { params: Promise<{ phase: string }> }) {
  const n = Number((await params).phase);
  const phase = getPhase(n);
  if (!phase) notFound();
  const focus = getFocus(n).map((f) => ({ ...f, name: unitName(f.baseId, f.name) }));
  const messages = focusToDiscord(n, phase.minRelic, focus, getSnapshot().syncedAt);

  return (
    <div className="space-y-5">
      <PhaseSwitcher current={n} href={(p) => `/phase/${p}/focus`} />
      <div>
        <h1 className="text-xl font-semibold">
          Phase {n} focus <span className="text-slate-400">(R{phase.minRelic})</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Every unit below its phase total, with the players whose gearing closes the gap soonest.
          Red units first, then the easiest wins.
        </p>
      </div>

      {focus.length > 0 && <CopyButtons messages={messages} />}

      {focus.length === 0 ? (
        <p className="rounded-xl bg-emerald-500/10 p-4 text-emerald-200 ring-1 ring-emerald-500/30">
          Every unit in this phase is covered.
        </p>
      ) : (
        <ul className="space-y-3">
          {focus.map((f) => (
            <li key={f.baseId} className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-slate-800">
              <div className="flex items-center gap-3">
                <StatusChip status={f.status} />
                <Link href={`/unit/${f.baseId}?phase=${n}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {f.name}
                </Link>
                <span className="text-sm tabular-nums">
                  <span className="font-semibold">{f.meets}</span>
                  <span className="text-slate-500"> / {f.need}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Need {f.gap} more.
                {!f.closable && (
                  <span className="text-rose-300">
                    {" "}Only {f.candidates.length} other {f.candidates.length === 1 ? "player owns" : "players own"} it, so it cannot be fully closed by gearing.
                  </span>
                )}
              </p>
              {f.candidates.length > 0 && (
                <ol className="mt-2 space-y-1">
                  {f.candidates.map((c) => (
                    <li key={c.allyCode} className="flex items-center gap-2 text-sm">
                      <Link href={`/player/${c.allyCode}?phase=${n}`} className="min-w-0 flex-1 truncate hover:underline">
                        {c.name}
                      </Link>
                      {c.needsStars && <span className="text-xs text-amber-300">needs stars</span>}
                      <span className="w-12 text-right font-mono text-slate-200">{c.label}</span>
                      <span className="w-24 text-right text-xs text-slate-500">{stepsLabel(c.distance, f.combatType === 2)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
