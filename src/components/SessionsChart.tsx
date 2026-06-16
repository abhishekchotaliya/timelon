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

export function SessionsChart({ data }: { data: Bucket[] }) {
  return (
    <div className="chart">
      <h3>Sessions completed</h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id="sessFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--text-dim)" fontSize={12} />
          <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
          <Tooltip
            formatter={(v: number) => [String(v), "Sessions"]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
            }}
          />
          <Area
            type="monotone"
            dataKey="sessions"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#sessFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
