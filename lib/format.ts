// Display helpers shared by the UI and the Discord export. No em dashes in output.
import type { FocusItem } from "./focus";
import type { Candidate } from "./matching";
import type { PhasePlan, UnitAllocation } from "./plan";

export const PLANET_SHORT: Record<string, string> = { "Dark Side": "DS", Mixed: "Mixed", "Light Side": "LS" };

const short = (alignment: string) => PLANET_SHORT[alignment] ?? alignment;

function joinWords(words: string[], last = "and"): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} ${last} ${words.at(-1)}`;
}

/** Phase level: which planets to fill completely. */
export function phasePlanSentence(plan: PhasePlan): string {
  const focus = joinWords(plan.focus.map(short));
  const rest = plan.planets.filter((p) => !p.focus);
  if (!plan.complete) {
    const f = plan.planets.find((p) => p.focus)!;
    return `No planet can be filled completely yet. Closest is ${focus}: ${f.slots - f.filled} of ${f.slots} slots still empty.`;
  }
  if (!rest.length) return "Every planet can be filled completely.";
  const gaps = joinWords(rest.map((p) => `${short(p.alignment)} ${p.slots - p.filled} short`));
  return `Focus on ${focus}: ${plan.focus.length === 1 ? "it" : "they"} can be filled completely. After that, ${gaps}.`;
}

/** Unit level: how this unit's players fit the phase plan. */
export function unitPlanSentence(alloc: UnitAllocation[]): string {
  const needed = alloc.filter((a) => a.required > 0);
  const focusShort = needed.filter((a) => a.focus && a.placed < a.required);
  const otherShort = needed.filter((a) => !a.focus && a.placed < a.required);
  if (focusShort.length) {
    const n = focusShort.reduce((s, a) => s + a.required - a.placed, 0);
    return `${n} short on ${joinWords(focusShort.map((a) => short(a.alignment)))}, the focus planet. Gear this unit first.`;
  }
  if (!otherShort.length) return "Enough for every planet.";
  const n = otherShort.reduce((s, a) => s + a.required - a.placed, 0);
  const focusHere = needed.some((a) => a.focus);
  const lead = focusHere ? "Covers the focus planet" : "Not needed on the focus planet";
  return `${lead}. ${n} more needed for ${joinWords(otherShort.map((a) => short(a.alignment)))}.`;
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
