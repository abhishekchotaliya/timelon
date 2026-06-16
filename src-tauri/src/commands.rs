//! Tauri commands invoked from the frontend. Each mutates the engine under a
//! short-lived lock (never held across `.await`), then syncs the UI + tray.

use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::{self, DayStat};
use crate::timer::{TimerConfig, TimerSnapshot};
use crate::{tray, AppState};

/// Broadcast a fresh snapshot to all windows and refresh the tray.
fn sync(app: &AppHandle, snap: &TimerSnapshot) {
    let _ = app.emit("tick", snap);
    tray::update_tray_title(app, snap);
}

#[tauri::command]
pub fn timer_start(app: AppHandle, state: State<AppState>) -> TimerSnapshot {
    let snap = {
        let mut e = state.engine.lock().unwrap();
        e.start();
        e.snapshot()
    };
    sync(&app, &snap);
    snap
}

#[tauri::command]
pub fn timer_pause(app: AppHandle, state: State<AppState>) -> TimerSnapshot {
    let snap = {
        let mut e = state.engine.lock().unwrap();
        e.pause();
        e.snapshot()
    };
    sync(&app, &snap);
    snap
}

#[tauri::command]
pub async fn timer_reset(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<TimerSnapshot, String> {
    let (snap, log) = {
        let mut e = state.engine.lock().unwrap();
        let log = e.reset();
        (e.snapshot(), log)
    };
    if let Some(log) = log {
        let _ = db::log_session(&state.db, &log).await;
    }
    sync(&app, &snap);
    Ok(snap)
}

#[tauri::command]
pub async fn timer_skip(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<TimerSnapshot, String> {
    let (snap, result) = {
        let mut e = state.engine.lock().unwrap();
        let result = e.finish_phase(false);
        (e.snapshot(), result)
    };
    let _ = db::log_session(&state.db, &result.log).await;
    tray::notify_phase_change(&app, &result.change);
    let _ = app.emit("phase-change", &result.change);
    sync(&app, &snap);
    Ok(snap)
}

#[tauri::command]
pub fn timer_snapshot(state: State<AppState>) -> TimerSnapshot {
    state.engine.lock().unwrap().snapshot()
}

#[tauri::command]
pub fn set_config(app: AppHandle, state: State<AppState>, cfg: TimerConfig) -> TimerSnapshot {
    let snap = {
        let mut e = state.engine.lock().unwrap();
        e.set_config(cfg);
        e.snapshot()
    };
    sync(&app, &snap);
    snap
}

#[tauri::command]
pub async fn stats_daily(
    state: State<'_, AppState>,
    start_day: String,
    end_day: String,
) -> Result<Vec<DayStat>, String> {
    db::query_daily(&state.db, &start_day, &end_day)
        .await
        .map_err(|e| e.to_string())
}
