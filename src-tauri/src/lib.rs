//! App wiring: plugins, managed state, the tray, and the 1s tick loop.

mod commands;
mod db;
mod timer;
mod tray;

use std::sync::Mutex;
use std::time::Duration;

use sqlx::SqlitePool;
use tauri::{Emitter, Manager};

use timer::{TimerConfig, TimerEngine};

pub struct AppState {
    pub engine: Mutex<TimerEngine>,
    pub db: SqlitePool,
}

/// Drive the engine: one tick per second for the app lifetime. Work is gated on
/// `running`; the lock is never held across an `.await`.
fn spawn_tick_loop(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        // Don't replay missed ticks as a burst (e.g. after the Mac sleeps, the
        // monotonic clock jumps and a default interval would fire every missed
        // second at once — firing dozens of phase-changes/notifications).
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut last = std::time::Instant::now();

        loop {
            interval.tick().await;

            // A large gap means the process was suspended (sleep) or otherwise
            // stalled. Treat it as a pause: don't count the gap or finish phases,
            // just resume cleanly on the next tick.
            let now = std::time::Instant::now();
            let gap = now.duration_since(last);
            last = now;
            if gap > Duration::from_secs(2) {
                continue;
            }

            let (snapshot, finished) = {
                let state = app.state::<AppState>();
                let mut e = state.engine.lock().unwrap();
                let reached_zero = e.tick();
                let finished = if reached_zero {
                    Some(e.finish_phase(true))
                } else {
                    None
                };
                (e.snapshot(), finished)
            };

            let did_finish = finished.is_some();
            if let Some(result) = finished {
                let pool = app.state::<AppState>().db.clone();
                let _ = db::log_session(&pool, &result.log).await;
                tray::notify_phase_change(&app, &result.change);
                let _ = app.emit("phase-change", &result.change);
            }

            // Emit while running, or once when a phase boundary is crossed.
            if snapshot.running || did_finish {
                let _ = app.emit("tick", &snapshot);
                tray::update_tray_title(&app, &snapshot);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();

            let data_dir = handle.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            let db_path = data_dir.join("timelon.db");
            let pool = tauri::async_runtime::block_on(db::init_db(db_path)).expect("init db");

            app.manage(AppState {
                engine: Mutex::new(TimerEngine::new(TimerConfig::default())),
                db: pool,
            });

            tray::build_tray(&handle)?;
            spawn_tick_loop(handle.clone());

            // Reflect the initial idle state on the tray.
            let snap = app.state::<AppState>().engine.lock().unwrap().snapshot();
            tray::update_tray_title(&handle, &snap);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::timer_start,
            commands::timer_pause,
            commands::timer_reset,
            commands::timer_skip,
            commands::timer_snapshot,
            commands::set_config,
            commands::stats_daily,
            commands::set_window_theme,
        ])
        .on_window_event(|window, event| {
            // Hide windows on close instead of destroying them, so the tray /
            // popover can re-show them later (otherwise get_webview_window
            // returns None and re-opening silently no-ops). Keeps the popover's
            // Audio context alive too.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
