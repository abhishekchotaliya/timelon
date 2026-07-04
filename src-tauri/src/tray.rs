//! Tray icon, menu, window toggling, and OS notifications.

use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::timer::{fmt_mmss, Phase, PhaseChange, TimerSnapshot};
use crate::AppState;

const TRAY_ID: &str = "main-tray";

/// Per-phase monochrome template icons (scripts/gen-tray-icons.mjs). Shown in
/// the menu bar and swapped when the phase changes.
const ICON_FOCUS: &[u8] = include_bytes!("../icons/focus.png");
const ICON_BREAK: &[u8] = include_bytes!("../icons/break.png");
const ICON_LONG_BREAK: &[u8] = include_bytes!("../icons/longbreak.png");

fn phase_icon(phase: Phase) -> &'static [u8] {
    match phase {
        Phase::Focus => ICON_FOCUS,
        Phase::ShortBreak => ICON_BREAK,
        Phase::LongBreak => ICON_LONG_BREAK,
    }
}

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

    let icon = tauri::image::Image::from_bytes(ICON_FOCUS)?;
    let builder = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main(tray.app_handle());
            }
        });

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

/// Tray left-click toggles the single app window.
fn toggle_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

pub fn show_main(app: &AppHandle, tab: &str) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        let _ = app.emit_to("main", "navigate", tab);
    }
}

/// macOS shows the tray title in the menu bar; on Windows it surfaces via the
/// tooltip. We set both so the live MM:SS is visible cross-platform.
/// Last time string pushed to the tray, so we only redraw the menu-bar image
/// when it actually changes (redrawing every tick made it flicker).
static LAST_TRAY_TIME: Mutex<String> = Mutex::new(String::new());

pub fn update_tray_title(app: &AppHandle, snap: &TimerSnapshot) {
    let time = fmt_mmss(snap.remaining_secs);
    {
        let mut last = LAST_TRAY_TIME.lock().unwrap();
        if *last == time {
            return; // unchanged — skip the redraw
        }
        *last = time.clone();
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        // Time as native title text (macOS auto-colors it to the menu bar and
        // updates it smoothly — no image swap, so no flicker). Digits are mapped
        // to fixed-width monospace glyphs so the width never wobbles when a
        // narrow digit like 1 changes to a wide one (macOS gives no API to set a
        // tabular-figures font on the tray title).
        let _ = tray.set_title(Some(monospace_digits(&time)));
        let _ = tray.set_tooltip(Some(format!("{} — {}", snap.phase.label(), time)));

        // Swap the icon only when the phase changes (rare), so the per-second
        // title updates never touch the icon — no flicker.
        let idx = match snap.phase {
            Phase::Focus => 0u8,
            Phase::ShortBreak => 1,
            Phase::LongBreak => 2,
        };
        let mut last = LAST_ICON_PHASE.lock().unwrap();
        if *last != idx {
            *last = idx;
            if let Ok(img) = tauri::image::Image::from_bytes(phase_icon(snap.phase)) {
                let _ = tray.set_icon(Some(img));
                let _ = tray.set_icon_as_template(true);
            }
        }
    }
}

/// Last phase whose icon is shown, so we only swap the tray icon on change.
static LAST_ICON_PHASE: Mutex<u8> = Mutex::new(255);

/// Map ASCII digits to Unicode mathematical-monospace digits (U+1D7F6..), which
/// are all equal width, keeping the menu-bar time from jittering. Other chars
/// (the colon) pass through unchanged.
fn monospace_digits(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_digit() {
                char::from_u32(0x1D7F6 + (c as u32 - '0' as u32)).unwrap_or(c)
            } else {
                c
            }
        })
        .collect()
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
