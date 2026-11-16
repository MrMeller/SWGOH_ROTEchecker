import { UnitBrowser } from "@/components/UnitBrowser";
import { getUnitIndex } from "@/lib/data";

export const metadata = { title: "Characters | RotE Platoon Tracker" };

export default function CharactersPage() {
  const rows = getUnitIndex();
  const chars = rows.filter((r) => r.combatType === 1).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Characters</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every unit the RotE platoons need, plus the characters the special missions name or count by faction ({chars} characters,{" "}
          {rows.length - chars} ships). Search or filter, then open a unit to see who meets it and who is closest.
        </p>
      </div>
      <UnitBrowser rows={rows} />
    </div>
  );
}
