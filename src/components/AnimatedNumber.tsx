const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// One rolling digit column. The column stacks 0–9; translateY slides the
// target digit to the top, passing through the intermediates as it moves.
function RollingDigit({ digit, duration }: { digit: number; duration?: number }) {
  return (
    <span className="odo-digit" aria-hidden>
      <span
        className="odo-col"
        style={{
          transform: `translateY(-${digit * 10}%)`,
          ...(duration != null ? { transitionDuration: `${duration}ms` } : {}),
        }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="odo-cell">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

// Renders a number as a suitcase-lock odometer: digits roll on change, unit
// characters ('.', 'h', 'm', '%', ' ') stay static. `format` maps the raw
// value to display text.
export function AnimatedNumber({
  value,
  format,
  duration,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const text = format(value);
  return (
    <span className="odo" aria-label={text}>
      {Array.from(text).map((ch, i) =>
        ch >= "0" && ch <= "9" ? (
          <RollingDigit key={i} digit={Number(ch)} duration={duration} />
        ) : (
          <span key={i} className="odo-static" aria-hidden>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
