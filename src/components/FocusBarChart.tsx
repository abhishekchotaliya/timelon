import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Bucket } from "../lib/stats";

export function FocusBarChart({ data }: { data: Bucket[] }) {
  return (
    <div className="chart">
      <h3>Focus minutes</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" stroke="var(--text-dim)" fontSize={12} />
          <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(0)} min`, "Focus"]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
            }}
          />
          <Bar dataKey="focusMin" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
