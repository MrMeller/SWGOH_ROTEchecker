import Link from "next/link";
import { getSnapshot, missionHref, snapshotCoversMissions, unitName } from "@/lib/data";
import { missionRequirement, rewardText, type MissionStatus, type UnlockStatus } from "@/lib/missions";

export const UNLOCK_STYLE: Record<UnlockStatus, { label: string; className: string; bar: string }> = {
  enough: { label: "Unlocks", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40", bar: "bg-emerald-400" },
  close: { label: "Close", className: "bg-amber-400/15 text-amber-200 ring-amber-400/40", bar: "bg-amber-300" },
  short: { label: "Short", className: "bg-rose-500/15 text-rose-300 ring-rose-500/40", bar: "bg-rose-400" },
};

export function UnlockChip({ status }: { status: UnlockStatus }) {
  const s = UNLOCK_STYLE[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}>{s.label}</span>;
}

/** One line on what the unlock needs: wins, and how many more ready members that takes. */
export function unlockSentence(u: NonNullable<MissionStatus["unlock"]>): string {
  const wins = `${u.wins} wins unlock ${u.planet}`;
  if (u.gap === 0) return `${wins}: covered, as long as everyone who is ready wins once.`;
  return `${wins}: ${u.gap} more ready member${u.gap === 1 ? "" : "s"} needed.`;
}

/** Shown when the roster was synced before the missions were tracked, so mission-only units are missing. */
export function CoverageNotice() {
  if (snapshotCoversMissions()) return null;
  return (
    <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-400/30">
      The roster data was synced before special missions were tracked, so units outside the platoons are not in it yet.
      Members look short on those until the next sync.
    </p>
  );
}

/** Ready count, reward and unlock bar: the numbers shared by the planet card and the mission page. */
export function MissionSummary({ status: s }: { status: MissionStatus }) {
  const members = getSnapshot().players.length;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-sm">
          <span className="text-2xl font-semibold text-white">{s.ready.length}</span>
          <span className="text-slate-400"> of {members} members ready</span>
        </span>
        <span className="text-xs text-slate-400">{rewardText(s.mission.reward)}</span>
      </div>
      {s.unlock && (
        <div className="mt-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
            <div className={UNLOCK_STYLE[s.unlock.status].bar} style={{ width: `${Math.min(100, (s.ready.length / s.unlock.wins) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-400">{unlockSentence(s.unlock)}</p>
        </div>
      )}
    </div>
  );
}

/** Planet page card, one per special mission, linking to the mission page. */
export function MissionCard({ status: s }: { status: MissionStatus }) {
  const m = s.mission;
  return (
    <Link href={missionHref(m)} className="block rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800 transition hover:bg-slate-800 hover:ring-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">
            <span className="text-slate-400">Special mission:</span> {m.title}
          </h3>
          <p className="mt-0.5 text-sm text-slate-300">{missionRequirement(m, (id) => unitName(id))}</p>
        </div>
        {s.unlock && <UnlockChip status={s.unlock.status} />}
      </div>
      <div className="mt-3">
        <MissionSummary status={s} />
      </div>
      <p className="mt-2 text-xs text-sky-400">Who is ready, who is close →</p>
    </Link>
  );
}
