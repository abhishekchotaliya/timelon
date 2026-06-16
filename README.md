# Timelon

A cross-platform focus / pomodoro timer for macOS and Windows, built with
**Tauri v2** (Rust core) and **React + TypeScript**. Lives in your menu bar /
tray as a quick popover, with a separate window for stats and settings.

## Features

- **Three auto-chaining phases** — Focus → Short Break → Long Break (a long
  break every _N_ focus sessions).
- **Tray popover** with a live countdown ring + Start / Pause / Reset / Skip,
  and a live `MM:SS` in the menu bar / tray.
- **Auto-start** breaks and/or focus sessions (optional).
- **Alerts** — OS notification + one of 5 built-in tunes on each phase change.
- **Themes** — light / dark / system + accent presets.
- **Reporting** — focus hours, sessions, breaks, and a day streak, with
  daily / weekly / monthly charts.
- **Persistent** — settings and session history survive restarts.

## Architecture

The timer state machine lives in **Rust** (`src-tauri/src/timer.rs`) so it
keeps accurate time and fires alerts even when every window is hidden. The
frontend is a pure view: it hydrates via `timer_snapshot` and reacts to the
`tick` and `phase-change` events. Sessions are persisted to SQLite (via `sqlx`)
and all stats are SQL aggregates grouped by local day. See `docs/PLAN.md` for
the full design and `CLAUDE.md` for the invariants.

## Develop

Prerequisites: [Node 18+](https://nodejs.org), the
[Rust toolchain](https://rustup.rs), and the Tauri v2 system dependencies for
your OS (see the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

```bash
npm install
npm run gen-sounds   # (re)generate the bundled alert tunes (already committed)
npm run tauri dev    # run the app
npm run tauri build  # produce a release bundle
```

> Note: the GUI requires a desktop environment with a webview; it cannot run in
> a headless CI container. macOS and Windows are the supported targets.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Bundled audio
must be CC0 / public domain; see [ASSETS.md](ASSETS.md).

## License

[MIT](LICENSE).
