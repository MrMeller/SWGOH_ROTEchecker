import type { Status } from "@/lib/status";

const STYLE: Record<Status, { label: string; className: string }> = {
  enough: { label: "Enough", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40" },
  planet: { label: "Planet only", className: "bg-amber-400/15 text-amber-200 ring-amber-400/40" },
  short: { label: "Short", className: "bg-rose-500/15 text-rose-300 ring-rose-500/40" },
};

export function StatusChip({ status }: { status: Status }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex w-22 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}>
      {s.label}
    </span>
  );
}

export const STATUS_DOT: Record<Status, string> = {
  enough: "bg-emerald-400",
  planet: "bg-amber-300",
  short: "bg-rose-400",
};
