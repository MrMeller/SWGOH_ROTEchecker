import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverageNotice, MissionSummary, UnlockChip } from "@/components/MissionCard";
import { PlanetTag } from "@/components/PlanetPlan";
import { PLANET_STYLE } from "@/components/planets";
import { allUnits, findMission, findPlanet, getMissionStatus, getMissions, getPhase, unitImage, unitName } from "@/lib/data";
import { missingText, missionRequirement, rewardText, tagPlural, type MissionCandidate } from "@/lib/missions";
import { planetSlug } from "@/lib/requirements";

export const dynamicParams = false;

export function generateStaticParams() {
  return getMissions().map((m) => ({ phase: String(m.phase), planet: planetSlug(m.planet), mission: m.id }));
}

type Params = Promise<{ phase: string; planet: string; mission: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { phase, planet, mission } = await params;
  const m = findMission(Number(phase), planet, mission);
  return { title: `${m?.title ?? "Special mission"} on ${m?.planet ?? "a planet"} | RotE Platoon Tracker` };
}

const name = (id: string) => unitName(id);

function shortLabel(c: MissionCandidate): string {
  return `${c.missing} short`;
}

export default async function MissionPage({ params }: { params: Params }) {
  const { phase: phaseParam, planet: slug, mission: id } = await params;
  const n = Number(phaseParam);
  const phase = getPhase(n);
  const planet = phase && findPlanet(phase, slug);
  const mission = findMission(n, slug, id);
  if (!phase || !planet || !mission) notFound();
  const s = getMissionStatus(mission);
  const style = PLANET_STYLE[planet.alignment];
  const unitPages = new Set(allUnits().map((u) => u.baseId));
  const squadWord = mission.tag ? tagPlural(mission.tag, 2) : "characters";

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/phase/${n}/planet/${slug}`} className="text-sm text-sky-400 hover:underline">
          ← {planet.name}
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span>
            <span className="text-slate-400">Special mission:</span> {mission.title}
          </span>
          {s.unlock && <UnlockChip status={s.unlock.status} />}
        </h1>
        <p className={`text-sm ${style.text}`}>
          {planet.name} <PlanetTag planet={planet} /> <span className="text-slate-400">phase {n}</span>
        </p>
        <p className="mt-2 text-sm text-slate-200">{missionRequirement(mission, name)}.</p>
        <p className="text-xs text-slate-500">
          {rewardText(mission.reward)}. One attempt per member; the mission stays open after the planet is three-starred and the next phase has
          started. Ready means the units are there, not that the battle is won.
        </p>
      </div>

      <div className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
        <MissionSummary status={s} />
      </div>

      <CoverageNotice />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Ready ({s.ready.length})</h2>
        {s.ready.length ? (
          <div className="flex flex-wrap gap-1.5">
            {s.ready.map((c) => (
              <Link
                key={c.allyCode}
                href={`/player/${c.allyCode}`}
                className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
              >
                {c.name}
                {c.atLevel > mission.squad && <span className="text-emerald-400"> {c.atLevel} {squadWord}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nobody yet.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Not ready yet ({s.notReady.length}), closest first</h2>
        {s.notReady.length ? (
          <ol className="divide-y divide-slate-800 overflow-hidden rounded-xl bg-slate-900/60 ring-1 ring-slate-800">
            {s.notReady.map((c, i) => (
              <li key={c.allyCode} className="px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-right text-xs text-slate-500">{i + 1}</span>
                  <Link href={`/player/${c.allyCode}`} className="min-w-0 flex-1 truncate hover:underline">
                    {c.name}
                  </Link>
                  {c.stale && <span className="text-xs text-amber-300">old data</span>}
                  <span className={`text-xs ${c.missing <= 1 ? "text-amber-200" : "text-rose-300"}`}>{shortLabel(c)}</span>
                </div>
                <p className="mt-0.5 pl-8 text-xs text-slate-400">{missingText(c, mission, name)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">Everyone is ready.</p>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-slate-300">Units that count ({s.units.length})</h2>
        <p className="mb-2 text-xs text-slate-500">
          Members with the unit at R{mission.minRelic} or higher, most first. A sky ring marks a unit the mission names.
          {mission.tag === null && mission.squad > mission.required.length + mission.anyOf.length && " Any character counts, so only the named ones are shown."}
        </p>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
          {s.units
            .filter((u) => mission.tag !== null || u.named)
            .map((u) => {
              const src = unitImage(u.baseId);
              const tile = (
                <>
                  <div className={`overflow-hidden rounded-md bg-slate-800 ${u.named ? "ring-2 ring-sky-400" : ""}`}>
                    {src ? (
                      <img src={src} alt={u.name} loading="lazy" className={`aspect-square w-full object-cover ${u.atLevel ? "" : "opacity-50 grayscale"}`} />
                    ) : (
                      <span className="flex aspect-square items-center p-1 text-center text-[9px] leading-tight">{u.name}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-center text-[11px] leading-tight tabular-nums">
                    <span className={u.atLevel ? "text-slate-100" : "text-slate-500"}>{u.atLevel}</span>
                    <span className="text-slate-500"> / {u.owned}</span>
                  </p>
                </>
              );
              return unitPages.has(u.baseId) ? (
                <Link key={u.baseId} href={`/unit/${u.baseId}?phase=${n}`} title={u.name} className="block hover:opacity-90">
                  {tile}
                </Link>
              ) : (
                <div key={u.baseId} title={u.name}>
                  {tile}
                </div>
              );
            })}
        </div>
        <p className="mt-1 text-xs text-slate-500">Under each portrait: members at the relic / members who own it.</p>
      </section>
    </div>
  );
}
