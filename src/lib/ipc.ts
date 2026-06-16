// Typed wrappers over Tauri commands + event listeners. The Rust payloads in
// src-tauri/src/timer.rs and db.rs are the source of truth for these shapes.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { DayStat, PhaseChange, TimerConfig, TimerSnapshot } from "../types";

export const timerStart = () => invoke<TimerSnapshot>("timer_start");
export const timerPause = () => invoke<TimerSnapshot>("timer_pause");
export const timerReset = () => invoke<TimerSnapshot>("timer_reset");
export const timerSkip = () => invoke<TimerSnapshot>("timer_skip");
export const timerSnapshot = () => invoke<TimerSnapshot>("timer_snapshot");

export const setConfig = (cfg: TimerConfig) =>
  invoke<TimerSnapshot>("set_config", { cfg });

export const statsDaily = (startDay: string, endDay: string) =>
  invoke<DayStat[]>("stats_daily", { startDay, endDay });

export const onTick = (cb: (s: TimerSnapshot) => void): Promise<UnlistenFn> =>
  listen<TimerSnapshot>("tick", (e) => cb(e.payload));

export const onPhaseChange = (cb: (p: PhaseChange) => void): Promise<UnlistenFn> =>
  listen<PhaseChange>("phase-change", (e) => cb(e.payload));

export const onNavigate = (cb: (tab: string) => void): Promise<UnlistenFn> =>
  listen<string>("navigate", (e) => cb(e.payload));
