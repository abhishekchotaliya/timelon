import type { Totals } from "../lib/stats";
import { Card } from "./ui/card";

function fmtDur(min: number): string {
  if (min >= 60) return `${(min / 60).toFixed(1)}h`;
  return `${Math.round(min)}m`;
}

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
    <div className="mb-[22px] grid grid-cols-3 gap-3">
      <StatCard label="Focus" value={fmtDur(totals.focusMin)} />
      <StatCard label="Break" value={fmtDur(totals.breakMin)} />
      <StatCard label="Long break" value={fmtDur(totals.longBreakMin)} />
      <StatCard label="Sessions" value={String(totals.sessions)} />
      <StatCard label="Breaks" value={String(totals.breaks)} />
      <StatCard label="Day streak" value={String(totals.streak)} />
    </div>
  );
}
