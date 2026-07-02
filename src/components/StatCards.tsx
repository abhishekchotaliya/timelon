import { CircleCheck, Coffee, Flame, Moon, Repeat, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { Totals } from "../lib/stats";
import { Card } from "./ui/card";

function fmtDur(min: number): string {
  if (min >= 60) return `${(min / 60).toFixed(1)}h`;
  return `${Math.round(min)}m`;
}

type IconType = ComponentType<{ className?: string; style?: React.CSSProperties }>;

function StatCard({
  label,
  value,
  Icon,
  color,
}: {
  label: string;
  value: string;
  Icon: IconType;
  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold">{value}</div>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="mt-1 text-[13px] text-muted-foreground">{label}</div>
    </Card>
  );
}

export function StatCards({ totals }: { totals: Totals }) {
  return (
    <div className="mb-[22px] grid grid-cols-3 gap-3">
      <StatCard label="Focus" value={fmtDur(totals.focusMin)} Icon={Target} color="var(--focus)" />
      <StatCard label="Break" value={fmtDur(totals.breakMin)} Icon={Coffee} color="var(--break)" />
      <StatCard
        label="Long break"
        value={fmtDur(totals.longBreakMin)}
        Icon={Moon}
        color="var(--long-break)"
      />
      <StatCard
        label="Sessions"
        value={String(totals.sessions)}
        Icon={CircleCheck}
        color="var(--focus)"
      />
      <StatCard label="Breaks" value={String(totals.breaks)} Icon={Repeat} color="var(--break)" />
      <StatCard
        label="Day streak"
        value={String(totals.streak)}
        Icon={Flame}
        color="var(--long-break)"
      />
    </div>
  );
}
