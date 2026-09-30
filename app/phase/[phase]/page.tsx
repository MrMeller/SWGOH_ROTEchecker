import { notFound } from "next/navigation";
import { PhaseOverview } from "@/components/PhaseOverview";
import { getPhase, PHASES } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return PHASES.map((p) => ({ phase: String(p) }));
}

export async function generateMetadata({ params }: { params: Promise<{ phase: string }> }) {
  return { title: `Phase ${(await params).phase} | RotE Platoon Tracker` };
}

export default async function PhasePage({ params }: { params: Promise<{ phase: string }> }) {
  const n = Number((await params).phase);
  if (!getPhase(n)) notFound();
  return <PhaseOverview phase={n} />;
}
