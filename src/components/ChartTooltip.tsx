type Props = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number }>;
  format?: (v: number) => string;
};

/// Glass tooltip shared by the stats charts.
export function ChartTooltip({ active, label, payload, format }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const value = typeof p.value === "number" ? p.value : 0;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-xl">
      <div className="mb-1 font-semibold text-foreground">{label}</div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--brand)" }}
        />
        {p.name}
        <span className="ml-1 font-semibold text-foreground">
          {format ? format(value) : value}
        </span>
      </div>
    </div>
  );
}
