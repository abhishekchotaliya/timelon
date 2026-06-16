import type { Totals } from "../lib/stats";
import { Card } from "./ui/card";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-[13px] text-muted-foreground">{label}</div>
    </Card>
  );
}

export function StatCards({ totals }: { totals: Totals }) {
  return (
    <div className="mb-[22px] grid grid-cols-4 gap-3">
      <StatCard label="Focus hours" value={totals.focusHours.toFixed(1)} />
      <StatCard label="Sessions" value={String(totals.sessions)} />
      <StatCard label="Breaks" value={String(totals.breaks)} />
      <StatCard label="Day streak" value={String(totals.streak)} />
    </div>
  );
}
