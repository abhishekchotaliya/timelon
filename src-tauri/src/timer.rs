//! The timer state machine. This is the single source of truth for the
//! countdown, the current phase, and phase chaining. The frontend is a pure
//! view that hydrates from `TimerSnapshot` and reacts to `tick` / `phase-change`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Focus,
    ShortBreak,
    LongBreak,
}

impl Phase {
    pub fn as_str(self) -> &'static str {
        match self {
            Phase::Focus => "focus",
            Phase::ShortBreak => "short_break",
            Phase::LongBreak => "long_break",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Phase::Focus => "Focus",
            Phase::ShortBreak => "Short Break",
            Phase::LongBreak => "Long Break",
        }
    }

    pub fn is_break(self) -> bool {
        matches!(self, Phase::ShortBreak | Phase::LongBreak)
    }
}

/// Durations + chaining flags. Mirrors `TimerConfig` in `src/types.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerConfig {
    pub focus_secs: u32,
    pub short_break_secs: u32,
    pub long_break_secs: u32,
    pub sessions_per_long_break: u32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
}

impl Default for TimerConfig {
    fn default() -> Self {
        Self {
            focus_secs: 25 * 60,
            short_break_secs: 5 * 60,
            long_break_secs: 15 * 60,
            sessions_per_long_break: 4,
            auto_start_breaks: false,
            auto_start_focus: false,
        }
    }
}

/// Snapshot broadcast on `tick` and returned by commands. Mirrors `TimerSnapshot`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerSnapshot {
    pub phase: Phase,
    pub running: bool,
    pub remaining_secs: u32,
    pub planned_secs: u32,
    pub completed_focus_count: u32,
}

/// Emitted on `phase-change`. Mirrors `PhaseChange`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseChange {
    pub ended_phase: Phase,
    pub ended_completed: bool,
    pub next_phase: Phase,
    pub auto_started: bool,
}

/// A row to persist when a phase ends (completed, skipped, or reset).
#[derive(Debug, Clone)]
pub struct SessionLog {
    pub phase: Phase,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    pub planned_secs: u32,
    pub actual_secs: u32,
    pub completed: bool,
}

/// Result of ending a phase: the row to log + the change to broadcast.
pub struct FinishResult {
    pub log: SessionLog,
    pub change: PhaseChange,
}

pub struct TimerEngine {
    cfg: TimerConfig,
    phase: Phase,
    remaining: u32,
    running: bool,
    completed_focus: u32,
    started_at: Option<DateTime<Utc>>,
    elapsed_in_phase: u32,
}

impl TimerEngine {
    pub fn new(cfg: TimerConfig) -> Self {
        let remaining = cfg.focus_secs;
        Self {
            cfg,
            phase: Phase::Focus,
            remaining,
            running: false,
            completed_focus: 0,
            started_at: None,
            elapsed_in_phase: 0,
        }
    }

    pub fn is_running(&self) -> bool {
        self.running
    }

    fn planned_for(&self, phase: Phase) -> u32 {
        match phase {
            Phase::Focus => self.cfg.focus_secs,
            Phase::ShortBreak => self.cfg.short_break_secs,
            Phase::LongBreak => self.cfg.long_break_secs,
        }
    }

    pub fn snapshot(&self) -> TimerSnapshot {
        TimerSnapshot {
            phase: self.phase,
            running: self.running,
            remaining_secs: self.remaining,
            planned_secs: self.planned_for(self.phase),
            completed_focus_count: self.completed_focus,
        }
    }

    pub fn start(&mut self) {
        if !self.running && self.remaining > 0 {
            self.running = true;
            if self.started_at.is_none() {
                self.started_at = Some(Utc::now());
            }
        }
    }

    pub fn pause(&mut self) {
        self.running = false;
    }

    /// Apply new config. Durations apply immediately only to an untouched,
    /// stopped phase so we never disrupt a run in progress.
    pub fn set_config(&mut self, cfg: TimerConfig) {
        self.cfg = cfg;
        if !self.running && self.elapsed_in_phase == 0 {
            self.remaining = self.planned_for(self.phase);
        }
    }

    /// Advance one second. Returns true if the phase just hit zero.
    pub fn tick(&mut self) -> bool {
        if self.running && self.remaining > 0 {
            self.remaining -= 1;
            self.elapsed_in_phase += 1;
            if self.remaining == 0 {
                return true;
            }
        }
        false
    }

    /// Reset the current phase to its full duration, stopped. Returns a partial
    /// log only if some time had already elapsed.
    pub fn reset(&mut self) -> Option<SessionLog> {
        let log = if self.elapsed_in_phase > 0 {
            Some(SessionLog {
                phase: self.phase,
                started_at: self.started_at.unwrap_or_else(Utc::now),
                ended_at: Utc::now(),
                planned_secs: self.planned_for(self.phase),
                actual_secs: self.elapsed_in_phase,
                completed: false,
            })
        } else {
            None
        };
        self.remaining = self.planned_for(self.phase);
        self.elapsed_in_phase = 0;
        self.running = false;
        self.started_at = None;
        log
    }

    /// End the current phase (completed or skipped), pick the next phase, and
    /// set it up (auto-starting per config). Returns the row to log + the change.
    pub fn finish_phase(&mut self, completed: bool) -> FinishResult {
        let ended_phase = self.phase;
        let planned = self.planned_for(ended_phase);
        let actual = if completed { planned } else { self.elapsed_in_phase };
        let started_at = self.started_at.unwrap_or_else(Utc::now);
        let ended_at = Utc::now();

        // Only fully-completed focus phases count toward the long break.
        if ended_phase == Phase::Focus && completed {
            self.completed_focus += 1;
        }

        let next_phase = match ended_phase {
            Phase::Focus => {
                if self.completed_focus >= self.cfg.sessions_per_long_break
                    && self.cfg.sessions_per_long_break > 0
                {
                    self.completed_focus = 0;
                    Phase::LongBreak
                } else {
                    Phase::ShortBreak
                }
            }
            Phase::ShortBreak | Phase::LongBreak => Phase::Focus,
        };

        let auto_started = if next_phase == Phase::Focus {
            self.cfg.auto_start_focus
        } else {
            self.cfg.auto_start_breaks
        };

        self.phase = next_phase;
        self.remaining = self.planned_for(next_phase);
        self.elapsed_in_phase = 0;
        self.running = auto_started;
        self.started_at = if auto_started { Some(Utc::now()) } else { None };

        FinishResult {
            log: SessionLog {
                phase: ended_phase,
                started_at,
                ended_at,
                planned_secs: planned,
                actual_secs: actual,
                completed,
            },
            change: PhaseChange {
                ended_phase,
                ended_completed: completed,
                next_phase,
                auto_started,
            },
        }
    }
}

pub fn fmt_mmss(secs: u32) -> String {
    format!("{:02}:{:02}", secs / 60, secs % 60)
}
