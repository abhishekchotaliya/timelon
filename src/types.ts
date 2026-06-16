// Mirror of the Rust payloads in src-tauri/src/timer.rs.
// These MUST stay in sync with the #[serde(rename_all = "camelCase")] structs.

export type Phase = "focus" | "short_break" | "long_break";

// Emitted on `tick` (every 1s while running) and returned by timer commands.
export type TimerSnapshot = {
  phase: Phase;
  running: boolean;
  remainingSecs: number;
  plannedSecs: number;
  completedFocusCount: number; // toward sessionsPerLongBreak
};

// Emitted on `phase-change` when a phase completes/skips and the next is chosen.
export type PhaseChange = {
  endedPhase: Phase;
  endedCompleted: boolean;
  nextPhase: Phase;
  autoStarted: boolean;
};

// Sent to Rust via set_config. Mirrors TimerConfig in timer.rs.
export type TimerConfig = {
  focusSecs: number;
  shortBreakSecs: number;
  longBreakSecs: number;
  sessionsPerLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
};

// Returned by the stats_daily command (mirrors DayStat in db.rs).
export type DayStat = {
  day: string; // YYYY-MM-DD (local)
  focusMin: number;
  sessions: number;
  breaks: number;
};

export const PHASE_LABELS: Record<Phase, string> = {
  focus: "Focus",
  short_break: "Short Break",
  long_break: "Long Break",
};
