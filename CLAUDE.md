# Timelon — Cross-platform Pomodoro (Tauri v2 + React/TS)

## Run
- Dev: `npm run tauri dev`
- Build: `npm run tauri build`
- Typecheck / frontend build only: `npm run typecheck` / `npm run build`
- Regenerate alert tunes: `npm run gen-sounds`

## Architecture invariants (do not violate)
- The TIMER state machine lives in Rust (`src-tauri/src/timer.rs`). The UI is a
  pure view that hydrates via `timer_snapshot` and listens to `tick` /
  `phase-change`. Never reimplement countdown logic in JS.
- There is ONE persistence path: writes go through `db::log_session`, stats
  reads through the `stats_daily` command (`src-tauri/src/db.rs`). All grouping
  is by local calendar `day`. Don't add a second persistence path or query
  SQLite from JS.
- Settings live in tauri-plugin-store (`settings.json`); the engine receives the
  timer-relevant subset via the `set_config` command.
- The tick loop holds the engine `Mutex` only briefly — never across an
  `.await` (extract data under the lock, then await DB writes / emit events).

## Event / command contracts
`src/types.ts` mirrors the Rust payloads (`TimerSnapshot`, `PhaseChange`,
`TimerConfig`, `DayStat`). Rust structs use `#[serde(rename_all = "camelCase")]`;
keep both sides in sync when changing a contract.

## Windows
- `popover` (tray timer) and `main` (stats + settings) are defined in
  `tauri.conf.json`; capabilities in `src-tauri/capabilities/default.json`.
  Missing capability permissions are the #1 Tauri v2 gotcha.
- The popover is hidden (never destroyed) on blur so its `Audio` stays alive.

## Assets
Bundled sounds must be CC0 / public domain. The built-ins are synthesized by
`scripts/gen-sounds.mjs` (original works, CC0); log attribution in `ASSETS.md`.
