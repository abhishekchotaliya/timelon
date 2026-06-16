import { useEffect, useState } from "react";

import { FocusBarChart } from "../components/FocusBarChart";
import { SessionsChart } from "../components/SessionsChart";
import { StatCards } from "../components/StatCards";
import { onPhaseChange } from "../lib/ipc";
import { loadStats, type Period, type StatsResult } from "../lib/stats";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];

export function StatsView() {
  const [period, setPeriod] = useState<Period>("daily");
  const [result, setResult] = useState<StatsResult | null>(null);

  const refresh = (p: Period) => {
    loadStats(p).then(setResult).catch(() => setResult(null));
  };

  useEffect(() => {
    refresh(period);
  }, [period]);

  // Refresh when a phase completes (new rows may have landed).
  useEffect(() => {
    const un = onPhaseChange(() => refresh(period));
    return () => {
      un.then((f) => f());
    };
  }, [period]);

  return (
    <div className="stats-view">
      <div className="period-tabs">
        {PERIODS.map((p) => (
          <button
            key={p}
            className={p === period ? "period active" : "period"}
            onClick={() => setPeriod(p)}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {result ? (
        <>
          <StatCards totals={result.totals} />
          <FocusBarChart data={result.buckets} />
          <SessionsChart data={result.buckets} />
        </>
      ) : (
        <p className="empty">No data yet — complete a focus session to see stats.</p>
      )}
    </div>
  );
}
