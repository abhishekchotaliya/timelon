import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Bucket } from "../lib/stats";
import { ChartTooltip } from "./ChartTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function SessionsChart({ data }: { data: Bucket[] }) {
  return (
    <Card className="mb-[18px]">
      <CardHeader>
        <CardTitle>Sessions completed</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="sessFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }}
              content={<ChartTooltip format={(v) => `${v}`} />}
            />
            <Area
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke="var(--brand)"
              strokeWidth={2}
              fill="url(#sessFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
