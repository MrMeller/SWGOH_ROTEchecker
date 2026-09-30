import { PlayerSearch } from "@/components/PlayerSearch";
import { getSnapshot } from "@/lib/data";

export const metadata = { title: "Players | RotE Platoon Tracker" };

export default function PlayersPage() {
  const players = getSnapshot().players.map(({ allyCode, name, stale }) => ({ allyCode, name, stale }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">What should I gear?</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pick your name to see the units the guild is short on where you are one of the closest players.
        </p>
      </div>
      <PlayerSearch players={players} />
    </div>
  );
}
