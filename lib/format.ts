// Display helpers shared by the UI and the Discord export. No em dashes in output.
import type { FocusItem } from "./focus";
import type { Candidate } from "./matching";

export const PLANET_SHORT: Record<string, string> = { "Dark Side": "DS", Mixed: "Mixed", "Light Side": "LS" };

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
