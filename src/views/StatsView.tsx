import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { AllTimePie } from "../components/AllTimePie";
import { FocusBarChart } from "../components/FocusBarChart";
import { SessionsChart } from "../components/SessionsChart";
import { StatCards } from "../components/StatCards";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { onPhaseChange, statsFirstDay } from "../lib/ipc";
import {
  canGoNext,
  canGoPrev,
  loadStats,
  periodLabel,
  shiftAnchor,
  type Period,
  type StatsResult,
} from "../lib/stats";

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export function StatsView() {
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [firstDay, setFirstDay] = useState<string | null>(null);
  const [result, setResult] = useState<StatsResult | null>(null);

  const refresh = (p: Period, a: Date) => {
    loadStats(p, a).then(setResult).catch(() => setResult(null));
    statsFirstDay().then(setFirstDay).catch(() => {});
  };

  useEffect(() => {
    refresh(period, anchor);
  }, [period, anchor]);

  // Refresh when a phase completes (new rows may have landed).
  useEffect(() => {
    const un = onPhaseChange(() => refresh(period, anchor));
    return () => {
      un.then((f) => f());
    };
  }, [period, anchor]);

  // Switching period jumps back to the current period.
  const changePeriod = (p: Period) => {
    setPeriod(p);
    setAnchor(new Date());
  };

  const barTitle = period === "year" ? "Time per month" : "Time per day";

  return (
    <div>
      <div className="sticky top-[-1.75rem] z-20 -mx-7 mb-[18px] flex items-center justify-between gap-3 border-b border-border bg-card px-7 py-4 backdrop-blur-2xl">
        <Tabs value={period} onValueChange={(v) => changePeriod(v as Period)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous period"
            disabled={!canGoPrev(period, anchor, firstDay)}
            onClick={() => setAnchor((a) => shiftAnchor(period, a, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium tabular-nums">
            {periodLabel(period, anchor)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next period"
            disabled={!canGoNext(period, anchor)}
            onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {result ? (
        <>
          <StatCards totals={result.totals} />
          <AllTimePie data={result.pie} />
          <FocusBarChart data={result.buckets} title={barTitle} />
          <SessionsChart data={result.buckets} />
        </>
      ) : (
        <p className="text-muted-foreground">
          No data yet — complete a focus session to see stats.
        </p>
      )}
    </div>
  );
}
