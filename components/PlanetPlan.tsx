import { planSentence } from "@/lib/format";
import { planetPlan } from "@/lib/status";

/** Planet colours as on the in-game map: Dark Side red, Mixed yellow, Light Side blue. */
export const PLANET_STYLE: Record<string, { label: string; accent: string; text: string }> = {
  "Dark Side": { label: "Dark Side", accent: "border-t-red-500", text: "text-red-300" },
  Mixed: { label: "Mixed", accent: "border-t-yellow-400", text: "text-yellow-200" },
  "Light Side": { label: "Light Side", accent: "border-t-sky-400", text: "text-sky-300" },
};

/** Three planet cards in map order, showing which ones the meeting players can fill. */
export function PlanetPlan({ planets, meets }: { planets: { alignment: string; required: number }[]; meets: number }) {
  const plan = planetPlan(planets, meets);
  const uniqueBest = plan.bestPlans.length === 1 ? new Set(plan.bestPlans[0]) : null;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {plan.planets.map((p) => {
          const style = PLANET_STYLE[p.alignment];
          if (!p.required) {
            return (
              <div key={p.alignment} className="rounded-lg border-t-4 border-t-slate-700 bg-slate-900/40 p-2.5 text-center">
                <p className="text-xs font-semibold text-slate-500">{style.label}</p>
                <p className="mt-1 text-xs text-slate-600">Not needed</p>
              </div>
            );
          }
          const highlight = uniqueBest?.has(p.alignment);
          return (
            <div
              key={p.alignment}
              className={`rounded-lg border-t-4 ${style.accent} bg-slate-900 p-2.5 text-center ${
                highlight ? "ring-1 ring-emerald-500/60" : "ring-1 ring-slate-800"
              }`}
            >
              <p className={`text-xs font-semibold ${style.text}`}>{style.label}</p>
              <p className="mt-1 text-lg leading-tight font-semibold tabular-nums">{p.required}</p>
              <p className="text-[11px] text-slate-500">needed</p>
              <p className={`mt-1.5 text-xs font-medium ${p.fillableAlone ? "text-emerald-300" : "text-rose-300"}`}>
                {p.fillableAlone ? "✓ Can fill" : `Short ${p.required - meets}`}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-slate-300">{planSentence(plan, meets)}</p>
    </div>
  );
}
