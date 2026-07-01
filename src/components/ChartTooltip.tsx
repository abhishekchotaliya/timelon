type Props = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  format?: (v: number) => string;
};

/// Glass tooltip shared by the stats charts (supports multiple series).
export function ChartTooltip({ active, label, payload, format }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-xl">
      <div className="mb-1 font-semibold text-foreground">{label}</div>
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: p.color ?? "var(--brand)" }}
            />
            {p.name}
            <span className="ml-2 font-semibold text-foreground">
              {typeof p.value === "number" && format ? format(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
