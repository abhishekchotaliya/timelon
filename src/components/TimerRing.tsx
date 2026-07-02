import type { Phase } from "../types";
import { PHASE_LABELS } from "../types";

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Props = {
  phase: Phase;
  remainingSecs: number;
  plannedSecs: number;
};

export function TimerRing({ phase, remainingSecs, plannedSecs }: Props) {
  const size = 240;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const progress = plannedSecs > 0 ? (plannedSecs - remainingSecs) / plannedSecs : 0;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));

  // Ring color follows the current phase (set as currentColor on the svg).
  const phaseVar =
    phase === "focus" ? "--focus" : phase === "short_break" ? "--break" : "--long-break";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="timer-ring"
      style={{ color: `var(${phaseVar})` }}
    >
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={1} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="ring-bg"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="ring-fg"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="48%" className="ring-time" textAnchor="middle" dominantBaseline="middle">
        {fmt(remainingSecs)}
      </text>
      <text x="50%" y="64%" className="ring-phase" textAnchor="middle" dominantBaseline="middle">
        {PHASE_LABELS[phase]}
      </text>
    </svg>
  );
}
