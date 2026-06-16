import type { Totals } from "../lib/stats";

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function StatCards({ totals }: { totals: Totals }) {
  return (
    <div className="stat-cards">
      <Card label="Focus hours" value={totals.focusHours.toFixed(1)} />
      <Card label="Sessions" value={String(totals.sessions)} />
      <Card label="Breaks" value={String(totals.breaks)} />
      <Card label="Day streak" value={String(totals.streak)} />
    </div>
  );
}
