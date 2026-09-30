// Display helpers shared by the UI and the Discord export. No em dashes in output.
import type { FocusItem } from "./focus";
import type { Candidate } from "./matching";
import type { PhasePlan, UnitAllocation } from "./plan";

function joinWords(words: string[], last = "and"): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} ${last} ${words.at(-1)}`;
}

/** Phase level: how many platoons the plan fills, per planet. */
export function phasePlanSentence(plan: PhasePlan): string {
  if (plan.filled === plan.total) return `Every platoon can be filled (${plan.total} of ${plan.total}).`;
  if (plan.filled === 0) return "No platoon can be filled completely yet.";
  const per = joinWords(plan.planets.filter((p) => p.filled).map((p) => `${p.planet} ${p.filled}`));
  return `${plan.filled} of ${plan.total} platoons can be filled at the same time: ${per}.`;
}

const platoonWord = (n: number) => `${n} platoon${n === 1 ? "" : "s"}`;

/** Unit level: how this unit fits the platoon plan. */
export function unitPlanSentence(alloc: UnitAllocation[]): string {
  const needed = alloc.filter((a) => a.required > 0);
  if (needed.every((a) => a.planned === a.required)) return "Enough for every platoon it is in.";
  const short = needed.filter((a) => a.shortFor > 0);
  if (short.length) {
    const where = joinWords(short.map((a) => `${platoonWord(a.shortFor)} on ${a.planet}`));
    return `Short for ${where}. Gearing this unit opens them up, if their other units are covered.`;
  }
  return "Enough for every platoon the plan fills. Other units hold its open platoons back.";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function stepsLabel(distance: number, ship: boolean): string {
  const unit = ship ? "star" : "step";
  return `${distance} ${unit}${distance === 1 ? "" : "s"} to go`;
}

function candidateText(c: Candidate): string {
  return `${c.name} ${c.label}${c.needsStars ? " (needs stars)" : ""}`;
}

export const DISCORD_LIMIT = 2000;

/** Discord-ready focus text for one phase, split into messages under the 2000 character limit. */
export function focusToDiscord(phase: number, minRelic: number, items: readonly FocusItem[], syncedAt: string): string[] {
  const header = `**RotE Phase ${phase} focus** (R${minRelic}, data from ${formatDate(syncedAt)})`;
  const lines = items.map((u) => {
    const who = u.candidates.length ? u.candidates.map(candidateText).join(", ") : "nobody owns it yet";
    const note = u.closable ? "" : ` (only ${u.owned - u.meets} of ${u.gap} needed own it)`;
    return `• **${u.name}** ${u.meets}/${u.need}: ${who}${note}`;
  });
  if (!lines.length) return [`${header}\nEvery unit is covered. Nice work!`];

  const messages: string[] = [];
  let current = header;
  for (const line of lines) {
    const safe = line.length > DISCORD_LIMIT - 10 ? line.slice(0, DISCORD_LIMIT - 11) + "…" : line;
    if (current.length + 1 + safe.length > DISCORD_LIMIT) {
      messages.push(current);
      current = safe;
    } else {
      current += "\n" + safe;
    }
  }
  messages.push(current);
  return messages;
}
