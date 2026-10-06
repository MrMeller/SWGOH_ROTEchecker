import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanetTag, PlatoonPills } from "@/components/PlanetPlan";
import { PLANET_STYLE } from "@/components/planets";
import { findPlanet, getPhase, getPhasePlan, getPhaseStatus, getRequirements, unitImage, unitName } from "@/lib/data";
import { platoonViews, type PlatoonView, type SlotState } from "@/lib/plan";
import { planetSlug } from "@/lib/requirements";

export const dynamicParams = false;

export function generateStaticParams() {
  return getRequirements().phases.flatMap((p) =>
    p.planets.map((pl) => ({ phase: String(p.phase), planet: planetSlug(pl.name) })),
  );
}

type Params = Promise<{ phase: string; planet: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { phase, planet } = await params;
  const pl = getPhase(Number(phase)) && findPlanet(getPhase(Number(phase))!, planet);
  return { title: `${pl?.name ?? "Planet"} P${phase} | RotE Platoon Tracker` };
}

/**
 * Styling per slot state: full colour only for platoons the plan fills. The fade goes on
 * the image, not the tile, so the red ring on lacking units keeps its colour.
 */
const SLOT_STYLE: Record<SlotState, { tile: string; image: string }> = {
  filled: { tile: "", image: "" },
  scarce: { tile: "ring-2 ring-amber-400", image: "" },
  lacking: { tile: "ring-2 ring-rose-500", image: "opacity-70 grayscale" },
  held: { tile: "", image: "opacity-35 grayscale" },
};

function badge(p: PlatoonView): { label: string; className: string } {
  if (p.fill === "day1") return { label: "Filled", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40" };
  if (p.fill === "later") return { label: "Day 2+", className: "bg-amber-400/15 text-amber-200 ring-amber-400/40" };
  const short = [...p.lacking.values()].reduce((a, n) => a + n, 0);
  if (!short) return { label: "Held back", className: "bg-slate-700/40 text-slate-300 ring-slate-600" };
  const label = `${short} short`;
  return short <= 2
    ? { label: `Almost, ${label}`, className: "bg-amber-400/15 text-amber-200 ring-amber-400/40" }
    : { label, className: "bg-rose-500/15 text-rose-300 ring-rose-500/40" };
}

export default async function PlanetPage({ params }: { params: Params }) {
  const { phase: phaseParam, planet: slug } = await params;
  const n = Number(phaseParam);
  const phase = getPhase(n);
  const planet = phase && findPlanet(phase, slug);
  if (!phase || !planet) notFound();

  const plan = getPhasePlan(n);
  const meets = new Map(getPhaseStatus(n).map((u) => [u.baseId, u.meets]));
  const platoons = platoonViews(phase, plan, planet.name, meets);
  const planetPlan = plan.planets.find((p) => p.planet === planet.name)!;
  const style = PLANET_STYLE[planet.alignment];

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/phase/${n}`} className="text-sm text-sky-400 hover:underline">
          ← Phase {n}
        </Link>
        <h1 className={`mt-2 text-xl font-semibold ${style.text}`}>
          {planet.name} <PlanetTag planet={planet} />
        </h1>
        <p className="text-sm text-slate-400">
          Phase {n}, R{phase.minRelic} needed. {planetPlan.filled} of {platoons.length} platoons can be filled with the
          current phase plan.
        </p>
        <PlatoonPills platoons={planetPlan.platoons} alignment={planet.alignment} className="mt-2 max-w-xs" />
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>Full colour: the plan fills this platoon.</span>
        <span>
          <span className="text-rose-300">Red ring</span>: a slot we have no player for yet.
        </span>
        <span>Faded: held back by other units or needed elsewhere.</span>
      </p>

      {/* Board order as in game: platoons 1 to 3 in the left column, 4 to 6 in the right. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-3">
        {platoons.map((p) => {
          const b = badge(p);
          return (
            <section
              key={p.number}
              className={`rounded-xl p-3 ring-1 ${p.fill ? "bg-slate-900 ring-slate-700" : "bg-slate-900/50 ring-slate-800"}`}
            >
              <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>Platoon {p.number}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${b.className}`}>{b.label}</span>
              </h2>
              <div className="grid grid-cols-5 gap-1.5">
                {p.slots.map((slot, i) => {
                  const name = unitName(slot.baseId);
                  const src = unitImage(slot.baseId);
                  return (
                    <Link
                      key={i}
                      href={`/unit/${slot.baseId}?phase=${n}`}
                      title={name}
                      className={`block overflow-hidden rounded-md bg-slate-800 ${SLOT_STYLE[slot.state].tile}`}
                    >
                      {src ? (
                        <img src={src} alt={name} loading="lazy" className={`aspect-square w-full object-cover ${SLOT_STYLE[slot.state].image}`} />
                      ) : (
                        <span className={`flex aspect-square items-center p-1 text-center text-[9px] leading-tight ${SLOT_STYLE[slot.state].image}`}>{name}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
              {p.lacking.size > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  Lacking:{" "}
                  {[...p.lacking].map(([id, count], i) => (
                    <span key={id}>
                      {i > 0 && ", "}
                      <Link href={`/unit/${id}?phase=${n}`} className="text-rose-300 hover:underline">
                        {unitName(id)}
                        {count > 1 && ` (${count} more)`}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
              {!p.fill && p.lacking.size === 0 && (
                <p className="mt-2 text-xs text-slate-500">Every unit is available, but the plan uses their players elsewhere.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
