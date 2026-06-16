# Implementation Spec — "Timelon" Pomodoro App (Flow/Tomato-style)

> **Purpose of this doc:** Self-contained handoff for a Claude Code implementer.
> Project root: `/Users/axar7/code/timelon` (repo: github.com/abhishekchotaliya/timelon).
> Read top-to-bottom; everything needed to build v1 is here. Where Tauri/plugin
> versions may have moved, verify against current docs — the *contracts* below
> (events, commands, schema) are the stable part.

---

## 1. Context & Goal
Build a cross-platform focus/pomodoro timer like **Flow** and **Tomato** (macOS).
Future Windows build must share the same codebase. Requirements from the user:

- Three phases: **Focus**, **Short Break**, **Long Break**, that **auto-chain**.
- **~5 selectable alert tunes** played when a phase completes.
- **Basic themes** (light/dark/system + accent presets).
- **Checkboxes** to auto-start the next session and/or break.
- **Reporting**: hours worked, breaks taken, sessions completed — with
  **daily / weekly / monthly graphs**.
- Ship **open-source on GitHub** (forkable, contributable).

## 2. Locked Technical Decisions
| Area | Choice | Why |
|---|---|---|
| Core shell | **Tauri v2** | ~10MB binary, low RAM, one codebase for macOS + Windows, first-class tray/notification/sql/autostart plugins. |
| Frontend | **React + TypeScript + Vite** | Tauri default template; best charting ecosystem; easy for contributors/AI. |
| Charts | **Recharts** | Declarative, React-native, good for bar/line/area. |
| Form factor | **Both** — tray popover **and** main window | Popover = quick timer (Flow-like). Main window = stats + settings (Tomato-like). |
| Timer authority | **Rust core** | Survives window hide/close, accurate, fires alerts unfocused. |
| Session data | **SQLite** (`tauri-plugin-sql`) | Powers all stats via SQL aggregates. |
| Settings | **`tauri-plugin-store`** (JSON) | Simple key/value config, reactive. |
| Distribution | **GitHub OSS, MIT, unsigned v1** | No Apple cert now; notarized `.dmg` later (optional). |

## 3. High-Level Architecture
```
┌──────────────────────────────────────────────────────────────┐
│ Rust core (src-tauri)                                          │
│  • TimerEngine state machine (tokio loop, 1s tick)             │
│  • Tray icon + menu, live MM:SS title                          │
│  • Commands: start/pause/reset/skip/set_config                 │
│  • Emits events: `tick`, `phase-change`                        │
│  • Fires OS notification on phase-change                       │
│  • Logs completed/partial phases to SQLite                     │
└───────────────▲───────────────────────────┬──────────────────┘
        invoke()│ (commands)         events  │ (tick, phase-change)
┌───────────────┴───────────────────────────▼──────────────────┐
│ React frontend                                                 │
│  • Popover window: TimerRing + controls                        │
│  • Main window: Stats tab (Recharts) + Settings tab            │
│  • Plays selected sound on `phase-change`                      │
│  • Reads/writes settings via store; reads stats via sql        │
└────────────────────────────────────────────────────────────────┘
```

**Why timer lives in Rust:** if the timer ran in JS, hiding/closing the popover
could suspend/destroy it. Rust owns the clock; the UI is a pure view. Sound + the
in-app countdown render in JS, but the *truth* (remaining time, phase) is Rust state
broadcast via events, so any window (or none) can be open.

---

## 4. Domain Model

### Phases & chaining
```
Focus → ShortBreak → Focus → ShortBreak → … → (every Nth focus) LongBreak → Focus …
```
- `sessionsPerLongBreak` (default 4): after N completed focus phases, the next break
  is a Long Break; the focus counter resets.
- Auto-chaining gated by two flags:
  - `autoStartBreaks`: when a Focus ends, immediately start the break.
  - `autoStartFocus`: when a break ends, immediately start the next Focus.
  - If a flag is off, the engine enters `Idle`/`Waiting` and waits for `start`.

### Settings (stored in `tauri-plugin-store`, file `settings.json`)
```ts
type Settings = {
  focusSecs: number;            // default 25*60
  shortBreakSecs: number;       // default 5*60
  longBreakSecs: number;        // default 15*60
  sessionsPerLongBreak: number; // default 4
  autoStartBreaks: boolean;     // default false
  autoStartFocus: boolean;      // default false
  launchAtLogin: boolean;       // default false (drives tauri-plugin-autostart)
  theme: "light" | "dark" | "system"; // default "system"
  accent: string;               // preset key, e.g. "tomato" | "indigo" | "forest"
  soundId: string;              // one of the bundled sound ids
  volume: number;               // 0..1, default 0.7
};
```

### Sessions (SQLite — source for all stats)
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phase         TEXT NOT NULL,        -- 'focus' | 'short_break' | 'long_break'
  started_at    TEXT NOT NULL,        -- ISO8601 UTC
  ended_at      TEXT,                 -- ISO8601 UTC, null if abandoned mid-run on crash
  planned_secs  INTEGER NOT NULL,
  actual_secs   INTEGER NOT NULL,     -- elapsed before complete/skip/reset
  completed     INTEGER NOT NULL,     -- 1 = ran full duration; 0 = skipped/reset early
  day           TEXT NOT NULL         -- 'YYYY-MM-DD' in LOCAL tz, for grouping
);
CREATE INDEX IF NOT EXISTS idx_sessions_day  ON sessions(day);
CREATE INDEX IF NOT EXISTS idx_sessions_phase ON sessions(phase);
```
**Logging rule:** insert one row each time a phase *ends* for any reason (completed,
skipped, or reset). `completed=1` only when it ran the full planned duration. `day` is
computed from local time so daily stats match the user's calendar.

---

## 5. Rust ↔ JS Contracts (the stable interface)

### Commands (invoked from JS)
```rust
#[tauri::command] fn timer_start(state: State<AppState>) -> TimerSnapshot;
#[tauri::command] fn timer_pause(state: State<AppState>) -> TimerSnapshot;
#[tauri::command] fn timer_reset(state: State<AppState>) -> TimerSnapshot;
#[tauri::command] fn timer_skip(state: State<AppState>)  -> TimerSnapshot; // end current phase now
#[tauri::command] fn timer_snapshot(state: State<AppState>) -> TimerSnapshot; // for window (re)load
#[tauri::command] fn set_config(state: State<AppState>, cfg: TimerConfig); // durations + auto flags
```

### Shared payloads
```ts
// emitted on `tick` (every 1s while running) and returned by commands
type TimerSnapshot = {
  phase: "focus" | "short_break" | "long_break";
  running: boolean;
  remainingSecs: number;
  plannedSecs: number;
  completedFocusCount: number; // toward sessionsPerLongBreak
};

// emitted on `phase-change` when a phase completes/skips and the next is chosen
type PhaseChange = {
  endedPhase: "focus" | "short_break" | "long_break";
  endedCompleted: boolean;
  nextPhase: "focus" | "short_break" | "long_break";
  autoStarted: boolean; // whether engine auto-started next per settings
};
```

### Events (Rust → JS, via `app.emit`)
- `tick` → `TimerSnapshot` (1/sec while running; also on pause/reset for immediate UI sync)
- `phase-change` → `PhaseChange` (frontend: play sound, maybe flash UI; Rust already
  fired the OS notification and logged the ended phase before emitting)

### Engine skeleton (illustrative — `src-tauri/src/timer.rs`)
```rust
pub struct TimerEngine {
    cfg: TimerConfig,
    phase: Phase,
    remaining: u32,
    running: bool,
    completed_focus: u32,
    started_at: Option<DateTime<Utc>>,
    elapsed_in_phase: u32,
}
// A single tokio task ticks every 1s:
//   if running { remaining -= 1; elapsed += 1; emit("tick", snapshot) }
//   if remaining == 0 { finish_phase(completed=true) }
// finish_phase: log_session(db), pick next phase (long-break logic),
//   notify(), emit("phase-change"), set running = autoStart flag for next phase.
```
Guard shared state with `Mutex<TimerEngine>` inside `AppState`; spawn the loop with
`tauri::async_runtime::spawn`. Keep the tick loop alive for app lifetime; gate work on
`running`.

---

## 6. Windows & Tray

### tauri.conf.json (key excerpts, v2)
```jsonc
{
  "app": {
    "windows": [
      {
        "label": "popover",
        "width": 320, "height": 420,
        "decorations": false, "resizable": false,
        "alwaysOnTop": true, "visible": false, "skipTaskbar": true
      },
      {
        "label": "main",
        "title": "Timelon",
        "width": 900, "height": 640,
        "visible": false
      }
    ]
  },
  "plugins": { /* sql, store, notification, autostart configured here / in code */ }
}
```
- **Popover behavior:** show on tray left-click positioned near the tray icon; hide on
  blur (`WindowEvent::Focused(false)`). Never destroy — keep webview (and its `Audio`)
  alive. On macOS set activation policy so it behaves like an accessory/menu-bar app
  (no Dock icon if desired) — evaluate `tauri-plugin-positioner` for tray anchoring.
- **Main window:** created hidden; shown via tray menu "Open Stats"/"Settings" or a
  popover button. Standard chrome.
- **Tray (`src-tauri/src/tray.rs`):** build with `TrayIconBuilder`; update `set_title`
  each tick with `MM:SS`; menu items: Start/Pause, Reset, Skip, Open Stats, Settings,
  Quit. Cross-platform note: macOS shows the title text in the menu bar; on Windows the
  title appears in the tray tooltip — acceptable, document it.

## 7. Frontend Structure (React + TS)
```
src/
├─ main-popover.tsx        # entry for popover window
├─ main-window.tsx         # entry for main window (Stats/Settings tabs)
├─ lib/
│  ├─ ipc.ts               # typed wrappers over invoke() + event listen()
│  ├─ db.ts                # tauri-plugin-sql queries for stats
│  ├─ settings.ts          # tauri-plugin-store load/save + React context
│  ├─ sounds.ts            # sound registry + play()
│  └─ theme.ts             # CSS-var theme application
├─ components/
│  ├─ TimerRing.tsx        # circular progress + MM:SS
│  ├─ Controls.tsx         # start/pause/reset/skip
│  ├─ StatCards.tsx        # totals + streak
│  ├─ FocusBarChart.tsx    # Recharts bar: focus minutes per bucket
│  └─ SessionsChart.tsx    # Recharts line/area: sessions per bucket
├─ views/
│  ├─ PopoverView.tsx
│  ├─ StatsView.tsx
│  └─ SettingsView.tsx
└─ types.ts                # mirror of Rust payloads (TimerSnapshot, etc.)
```
- Vite multi-page: two HTML entries (`popover.html`, `index.html`) → two bundles, one
  per window label.
- On window load, call `timer_snapshot` to hydrate, then subscribe to `tick` /
  `phase-change`.

## 8. Stats Queries (run via tauri-plugin-sql)
```sql
-- Daily focus minutes for a date range
SELECT day,
       SUM(CASE WHEN phase='focus' THEN actual_secs ELSE 0 END)/60.0 AS focus_min,
       SUM(CASE WHEN phase='focus' AND completed=1 THEN 1 ELSE 0 END) AS sessions,
       SUM(CASE WHEN phase LIKE '%break%' THEN 1 ELSE 0 END)          AS breaks
FROM sessions
WHERE day BETWEEN ?1 AND ?2
GROUP BY day ORDER BY day;
```
- **Weekly:** group by ISO week (compute in JS from `day`, or `strftime('%Y-%W', day)`).
- **Monthly:** `strftime('%Y-%m', day)`.
- **Streak:** consecutive days (ending today) with ≥1 completed focus session — compute
  in JS from the daily rows.
- Summary cards: total focus hours, total sessions, total breaks for selected period.

## 9. Sounds
- Bundle ~5 short alert tunes under `src-tauri/assets/sounds/` (or frontend `public/sounds/`).
- **License constraint (open-source repo): must be CC0 / public domain** (e.g. Pixabay,
  freesound CC0). Record each file's source + license in `ASSETS.md`. Do **not** ship
  copyrighted/ripped audio.
- Registry in `lib/sounds.ts`: `{ id, label, file }[]`. Settings store `soundId` + `volume`.
- Play on `phase-change` via `new Audio(url); a.volume = volume; a.play()`. Provide a
  **Preview** button in Settings.

## 10. Themes
- CSS custom properties on `:root`; `theme.ts` toggles `data-theme` attr (light/dark) and
  sets `--accent` from the chosen preset. `"system"` follows `prefers-color-scheme`.
- 2–3 accent presets to start (e.g. `tomato`, `indigo`, `forest`).

## 11. Open-Source Repo Hygiene
- `LICENSE` (MIT), `README.md` (features, screenshots, build/run, contributing pointer),
  `CONTRIBUTING.md` (dev setup, `npm run tauri dev`, code style), `ASSETS.md` (sound
  attributions), `.gitignore` (node_modules, target, dist).
- **CI** `.github/workflows/build.yml`: matrix `{ macos-latest, windows-latest }` →
  `npm ci`, `npm run tauri build`, upload artifacts. Tag-triggered release optional.

---

## 12. Recommended Claude Code Artifacts (for the implementing repo)
Create these so future Claude Code sessions (and contributors) stay aligned. Place in
the project, not in this plan.

### `CLAUDE.md` (project root) — seed content
```md
# Timelon — Cross-platform Pomodoro (Tauri v2 + React/TS)

## Run
- Dev: `npm run tauri dev`
- Build: `npm run tauri build`

## Architecture invariants (do not violate)
- The TIMER state machine lives in Rust (`src-tauri/src/timer.rs`). The UI is a pure
  view that hydrates via `timer_snapshot` and listens to `tick` / `phase-change`.
  Never reimplement countdown logic in JS.
- All persisted session rows go through `db.rs` log helper; stats are SQL aggregates
  grouped by local `day`. Don't add a second persistence path.
- Settings live in tauri-plugin-store; the engine reads config via `set_config`.

## Event/command contracts
See `src/types.ts` (TimerSnapshot, PhaseChange) — Rust payloads MUST match these.

## Bundled sounds must be CC0/public-domain; log attribution in ASSETS.md.
```

### Suggested subagents (`.claude/agents/`)
- **`tauri-rust-dev`** — owns `src-tauri` (engine, tray, commands, sql). Tools: Bash,
  Read, Edit, Write. Knows tokio loop + Mutex state pattern.
- **`react-ui-dev`** — owns `src` frontend, Recharts, theming. Tools: Read, Edit, Write,
  Bash (vite/npm).
- (Optional) **`ipc-contract-guard`** — read-only check that Rust payload structs and
  `src/types.ts` stay in sync; run before commits.

### Suggested skills (`.claude/skills/`)
- **`run-app`** — wraps `npm run tauri dev`, waits for window, reports.
- **`add-sound`** — scaffold steps to add a CC0 tune: drop file, register in
  `lib/sounds.ts`, append `ASSETS.md` attribution.

> These are *suggestions*; create them once the scaffold exists so paths are real.

---

## 13. Build Milestones (each independently runnable/verifiable)
1. **Scaffold** — `npm create tauri-app@latest` (React/TS, Vite). MIT license, base
   `CLAUDE.md`. Verify `npm run tauri dev` opens a window.
2. **Core timer + tray + popover** — Rust `TimerEngine` + tokio tick, commands, `tick`
   event; tray with live `MM:SS` title; popover anchored to tray with start/pause/
   reset/skip. *Verify:* countdown ticks, tray updates, controls work.
3. **Phases + chaining + alerts** — long-break-after-N logic, `autoStartBreaks` /
   `autoStartFocus`, OS notification + 5 bundled sounds on `phase-change`. *Verify:*
   short test durations chain correctly with flags on/off; notification + sound fire.
4. **Settings + themes** — store-backed `Settings`, duration inputs, theme/accent
   picker, sound picker + preview + volume, launch-at-login (`tauri-plugin-autostart`).
   *Verify:* changes persist across restart; engine respects new durations/flags.
5. **Persistence** — SQLite schema + migration, log each ended phase. *Verify:* rows
   appear with correct `completed`/`day`.
6. **Stats window** — Recharts daily/weekly/monthly + summary cards + streak. *Verify:*
   totals match logged rows across all three periods.
7. **Polish + cross-platform** — Windows tray/positioning checks, icons, README +
   CONTRIBUTING + ASSETS, GitHub Actions mac+win build matrix. *Verify:* `tauri build`
   produces runnable macOS bundle; CI builds Windows target.

## 14. End-to-End Verification Checklist
- [ ] `npm run tauri dev` — popover opens from tray; countdown ticks; tray title live.
- [ ] Set focus=5s; run → notification + sound on complete; auto-chains to break when
      `autoStartBreaks` on, waits when off; long break after N focus phases.
- [ ] Skip/Reset log partial rows (`completed=0`); full runs log `completed=1`.
- [ ] Quit + reopen → settings persist (store) and sessions persist (SQLite).
- [ ] Stats tab Daily/Weekly/Monthly totals reconcile with `sessions` table.
- [ ] `npm run tauri build` → runnable macOS app; CI matrix green for mac + windows.

## 15. Deferred / Out of Scope (v1)
- Projects/tags per session (Flow-style labels) — schema can add `project_id` later.
- Code-signing / notarization — unsigned v1; revisit for notarized `.dmg`.
- Idle detection / pause-on-sleep, global hotkeys, iCloud/sync — nice-to-haves.

## 16. Key Dependencies (verify current versions at build time)
- Rust crates: `tauri` v2, `tokio`, `chrono`, `serde`.
- Tauri plugins: `tauri-plugin-sql`, `tauri-plugin-store`, `tauri-plugin-notification`,
  `tauri-plugin-autostart`, (optional) `tauri-plugin-positioner`.
- npm: `react`, `react-dom`, `typescript`, `vite`, `@tauri-apps/api`,
  `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-store`,
  `@tauri-apps/plugin-notification`, `recharts`.
- **Tauri v2 capabilities:** add a capability JSON granting permissions for each plugin
  and the windows that use them (`src-tauri/capabilities/`). Missing capabilities are
  the #1 v2 gotcha.
