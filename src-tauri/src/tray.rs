//! Tray icon, menu, popover toggling, and OS notifications.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_positioner::{Position, WindowExt};

use crate::timer::{fmt_mmss, Phase, PhaseChange, TimerSnapshot};
use crate::AppState;

const TRAY_ID: &str = "main-tray";

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let start_pause = MenuItem::with_id(app, "start_pause", "Start / Pause", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "reset", "Reset", true, None::<&str>)?;
    let skip = MenuItem::with_id(app, "skip", "Skip", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let stats = MenuItem::with_id(app, "open_stats", "Open Stats", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "open_settings", "Settings", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Timelon", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &start_pause,
            &reset,
            &skip,
            &sep1,
            &stats,
            &settings,
            &sep2,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            // Let the positioner track the tray rect for tray-relative anchoring.
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_popover(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn handle_menu(app: &AppHandle, id: &str) {
    match id {
        "start_pause" => {
            let snap = {
                let state = app.state::<AppState>();
                let mut e = state.engine.lock().unwrap();
                if e.is_running() {
                    e.pause();
                } else {
                    e.start();
                }
                e.snapshot()
            };
            let _ = app.emit("tick", &snap);
            update_tray_title(app, &snap);
        }
        "reset" => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let (snap, log) = {
                    let state = app.state::<AppState>();
                    let mut e = state.engine.lock().unwrap();
                    let log = e.reset();
                    (e.snapshot(), log)
                };
                if let Some(log) = log {
                    let pool = app.state::<AppState>().db.clone();
                    let _ = crate::db::log_session(&pool, &log).await;
                }
                let _ = app.emit("tick", &snap);
                update_tray_title(&app, &snap);
            });
        }
        "skip" => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let (snap, result) = {
                    let state = app.state::<AppState>();
                    let mut e = state.engine.lock().unwrap();
                    let result = e.finish_phase(false);
                    (e.snapshot(), result)
                };
                let pool = app.state::<AppState>().db.clone();
                let _ = crate::db::log_session(&pool, &result.log).await;
                notify_phase_change(&app, &result.change);
                let _ = app.emit("phase-change", &result.change);
                let _ = app.emit("tick", &snap);
                update_tray_title(&app, &snap);
            });
        }
        "open_stats" => show_main(app, "stats"),
        "open_settings" => show_main(app, "settings"),
        "quit" => app.exit(0),
        _ => {}
    }
}

fn toggle_popover(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("popover") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.move_window(Position::TrayBottomCenter);
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

fn show_main(app: &AppHandle, tab: &str) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        let _ = app.emit_to("main", "navigate", tab);
    }
}

/// macOS shows the tray title in the menu bar; on Windows it surfaces via the
/// tooltip. We set both so the live MM:SS is visible cross-platform.
pub fn update_tray_title(app: &AppHandle, snap: &TimerSnapshot) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let glyph = match snap.phase {
            Phase::Focus => "🍅",
            Phase::ShortBreak => "☕",
            Phase::LongBreak => "🌙",
        };
        let time = fmt_mmss(snap.remaining_secs);
        let _ = tray.set_title(Some(format!("{glyph} {time}")));
        let _ = tray.set_tooltip(Some(format!("{} — {}", snap.phase.label(), time)));
    }
}

pub fn notify_phase_change(app: &AppHandle, change: &PhaseChange) {
    let body = if change.auto_started {
        format!(
            "{} finished. Starting {}.",
            change.ended_phase.label(),
            change.next_phase.label()
        )
    } else {
        format!(
            "{} finished. Next: {}.",
            change.ended_phase.label(),
            change.next_phase.label()
        )
    };
    let _ = app
        .notification()
        .builder()
        .title("Timelon")
        .body(body)
        .show();
}
