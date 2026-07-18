import { useCountUp } from "../lib/useCountUp";

// Renders a number that eases from its previous value to `value` on change.
// `format` maps the in-flight float to display text (round for counts, etc).
export function AnimatedNumber({
  value,
  format,
  duration,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const v = useCountUp(value, duration);
  return <>{format(v)}</>;
}
