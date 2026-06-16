# Contributing to Timelon

Thanks for your interest! Timelon is MIT-licensed and contributions are welcome.

## Dev setup

1. Install [Node 18+](https://nodejs.org), the [Rust toolchain](https://rustup.rs),
   and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)
   for your OS.
2. `npm install`
3. `npm run tauri dev`

## Project layout

- `src-tauri/` — Rust core: `timer.rs` (state machine), `db.rs` (SQLite via
  `sqlx`), `commands.rs` (IPC), `tray.rs` (tray + notifications), `lib.rs`
  (wiring + tick loop).
- `src/` — React frontend: `lib/` (ipc, settings, sounds, theme, stats),
  `components/`, `views/`, plus two window entry points (`main-popover.tsx`,
  `main-window.tsx`).
- `docs/PLAN.md` — full design spec. `CLAUDE.md` — invariants to respect.

## Conventions

- Keep the timer logic in Rust; the frontend is a pure view (see `CLAUDE.md`).
- When changing an IPC payload, update both the Rust struct and `src/types.ts`.
- Before opening a PR: `npm run typecheck`, `npm run build`, and
  `cargo fmt` / `cargo clippy` in `src-tauri/`.
- Bundled audio must be CC0 / public domain — add attribution to `ASSETS.md`.

## Pull requests

Keep PRs focused and describe the change + how you tested it. For UI changes, a
screenshot or short clip helps.
