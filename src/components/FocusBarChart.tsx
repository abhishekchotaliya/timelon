import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Bucket } from "../lib/stats";
import { ChartTooltip } from "./ChartTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

// Phase colors from the active color scheme.
const COLORS = {
  focus: "var(--focus)",
  break: "var(--break)",
  longBreak: "var(--long-break)",
};

export function FocusBarChart({ data, title = "Time per day" }: { data: Bucket[]; title?: string }) {
  return (
    <Card className="mb-[18px]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.1 }}
              content={<ChartTooltip format={(v) => `${Math.round(v)} min`} />}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
            />
            <Bar
              dataKey="focusMin"
              stackId="t"
              name="Focus"
              fill={COLORS.focus}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="breakMin"
              stackId="t"
              name="Break"
              fill={COLORS.break}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="longBreakMin"
              stackId="t"
              name="Long break"
              fill={COLORS.longBreak}
              radius={[6, 6, 0, 0]}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
