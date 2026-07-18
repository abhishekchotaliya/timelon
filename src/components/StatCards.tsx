import { CircleCheck, Coffee, Flame, Moon, Repeat, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { Totals } from "../lib/stats";
import { AnimatedNumber } from "./AnimatedNumber";
import { Card } from "./ui/card";

function fmtDur(min: number): string {
  if (min >= 60) return `${(min / 60).toFixed(1)}h`;
  return `${Math.round(min)}m`;
}

const fmtInt = (n: number): string => String(Math.round(n));

type IconType = ComponentType<{ className?: string; style?: React.CSSProperties }>;

function StatCard({
  label,
  value,
  format,
  Icon,
  color,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  Icon: IconType;
  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold tabular-nums">
          <AnimatedNumber value={value} format={format} />
        </div>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="mt-1 text-[13px] text-muted-foreground">{label}</div>
    </Card>
  );
}

export function StatCards({ totals }: { totals: Totals }) {
  return (
    <div className="mb-[22px] grid grid-cols-3 gap-3">
      <StatCard
        label="Focus"
        value={totals.focusMin}
        format={fmtDur}
        Icon={Target}
        color="var(--focus)"
      />
      <StatCard
        label="Break"
        value={totals.breakMin}
        format={fmtDur}
        Icon={Coffee}
        color="var(--break)"
      />
      <StatCard
        label="Long break"
        value={totals.longBreakMin}
        format={fmtDur}
        Icon={Moon}
        color="var(--long-break)"
      />
      <StatCard
        label="Sessions"
        value={totals.sessions}
        format={fmtInt}
        Icon={CircleCheck}
        color="var(--focus)"
      />
      <StatCard
        label="Breaks"
        value={totals.breaks}
        format={fmtInt}
        Icon={Repeat}
        color="var(--break)"
      />
      <StatCard
        label="Day streak"
        value={totals.streak}
        format={fmtInt}
        Icon={Flame}
        color="var(--long-break)"
      />
    </div>
  );
}
