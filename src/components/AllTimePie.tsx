import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { PieData } from "../lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

// Phase colors from the active color scheme.
const COLORS = ["var(--focus)", "var(--break)", "var(--long-break)"];

function fmt(min: number): string {
  return min >= 60 ? `${(min / 60).toFixed(1)} h` : `${Math.round(min)} min`;
}

export function AllTimePie({ data }: { data: PieData }) {
  const slices = [
    { name: "Focus", value: Math.round(data.focus) },
    { name: "Short break", value: Math.round(data.shortBreak) },
    { name: "Long break", value: Math.round(data.longBreak) },
  ];
  const total = slices.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="mb-[18px]">
      <CardHeader>
        <CardTitle>Time Split</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground">No time logged yet.</p>
        ) : (
          <div className="flex items-center gap-8">
            <div className="relative h-[180px] w-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={86}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {slices.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{fmt(total)}</span>
                <span className="text-[11px] text-muted-foreground">total</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              {slices.map((sl, i) => (
                <div key={sl.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: COLORS[i] }}
                  />
                  <span className="text-muted-foreground">{sl.name}</span>
                  <span className="ml-auto font-semibold text-foreground">
                    {fmt(sl.value)}
                  </span>
                  <span className="w-12 text-right text-xs text-muted-foreground">
                    {total ? Math.round((sl.value / total) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
